"""Journal gate: a narrow, closed-enum door onto the private Journal.

Design (owner decision, 2026-09-27): the existing hard wall stays
EXACTLY as strict as it is today — ``_require_person`` in ``api.py``
still flatly refuses every agent principal on ``/api/journal*`` and
``/api/recall``, unconditionally, regardless of scope. This module is
an ADDITIONAL narrow door, reached only through the ``journal_gate``
confining scope (see ``api.CONFINING_SCOPES``): an agent holding that
scope may ask a closed-enum question ("does the journal relate to X
lately?") and gets back a closed-enum answer. It never gets retrieval
results, entry text, or free-form output.

The retrieval step and the model step are both deliberately
replaceable and untrusted:

- ``retrieve`` is a relevance filter, not the security boundary — it
  decides what the model stand-in gets to look at.
- ``mock_model`` stands in for a real model (a later step wires one
  in). Nothing about the security property depends on this function
  being trustworthy.
- ``_validate`` is the actual boundary. It structurally cannot pass
  through anything but the closed Answer schema, and separately
  rejects any answer that shares a long run of words with a retrieved
  entry's real text — this catches a model (mock or real) that tries
  to leak verbatim content through an enum-shaped field. On any
  failure anywhere, the gate collapses to ``unsure`` and count "0" —
  never an exception, never partial output.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .classification import Classification
from .journal import Journal
from .model import JournalEvent


class Ask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ask: Literal["relates_to", "written_lately"]
    topic: str = Field(max_length=80)
    window_days: Literal[7, 30, 90]


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: Literal["yes", "no", "unsure"]
    strength: Literal["weak", "strong"] | None = None
    when: Literal["this_week", "this_month", "older"] | None = None
    count: Literal["0", "1-2", "3-9", "10+"]


UNSURE = Answer(answer="unsure", strength=None, when=None, count="0")


def _aware(ts: datetime) -> datetime:
    return ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)


def _window_events(journal: Journal, window_days: int) -> list[JournalEvent]:
    """Current (non-superseded), non-secret entries inside the window.

    Secret-classified rows are excluded defensively even though nothing
    in this codebase currently classifies journal entries as SECRET —
    a gate over private memory should not assume that stays true.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    total = sum(1 for _ in journal.events())
    out = []
    for e in journal.current_events(n=max(total, 1)):
        if e.classification == Classification.SECRET:
            continue
        if _aware(e.ts) >= cutoff:
            out.append(e)
    return out


_STOPWORDS = {"the", "a", "an", "of", "to", "in", "on", "for", "and", "is", "was"}


def retrieve(topic: str, journal: Journal, window_days: int) -> list[JournalEvent]:
    """Deliberately dumb word-overlap retrieval — a relevance filter
    for the model stand-in, never the security boundary."""
    topic_words = {w.lower() for w in topic.split() if len(w) > 2} - _STOPWORDS
    if not topic_words:
        return []
    hits = []
    for e in _window_events(journal, window_days):
        text_words = {w.lower().strip(".,!?;:\"'") for w in e.summary.split()}
        if topic_words & text_words:
            hits.append(e)
    return hits


def mock_model(ask: Ask, hits: list[JournalEvent]) -> dict[str, Any]:
    """Stand-in for a real model. Deterministic, no I/O, no network.

    Turns retrieval hits into a closed-enum-shaped dict. A later step
    replaces ONLY this function with a real local model call — the
    validator downstream enforces the schema regardless of what any
    model (mock or real) returns.
    """
    n = len(hits)
    if n == 0:
        return {"answer": "no", "strength": None, "when": None, "count": "0"}
    count = "1-2" if n <= 2 else "3-9" if n <= 9 else "10+"
    newest = max(hits, key=lambda e: e.ts)
    age_days = (datetime.now(timezone.utc) - _aware(newest.ts)).days
    when = "this_week" if age_days <= 7 else "this_month" if age_days <= 30 else "older"
    strength = "strong" if n >= 3 else "weak"
    return {"answer": "yes", "strength": strength, "when": when, "count": count}


def _shares_long_run(candidate: str, hits: list[JournalEvent], run_len: int = 5) -> bool:
    """True if ``candidate`` shares ``run_len``+ consecutive words with
    any retrieved entry's real text. The leak check, independent of
    what a model claims its output means."""
    cand_words = candidate.lower().split()
    if len(cand_words) < run_len:
        return False
    windows = {
        tuple(cand_words[i : i + run_len])
        for i in range(len(cand_words) - run_len + 1)
    }
    for e in hits:
        entry_words = e.summary.lower().split()
        for i in range(len(entry_words) - run_len + 1):
            if tuple(entry_words[i : i + run_len]) in windows:
                return True
    return False


def _validate(raw: dict[str, Any], hits: list[JournalEvent]) -> Answer:
    try:
        answer = Answer.model_validate(raw)
    except Exception:
        return UNSURE
    for value in (answer.answer, answer.strength, answer.when, answer.count):
        if isinstance(value, str) and _shares_long_run(value, hits):
            return UNSURE
    return answer


def gate(ask_raw: dict[str, Any], journal: Journal) -> dict[str, Any]:
    """The whole gate in one call. Any failure anywhere — a malformed
    Ask, a malformed model answer, or a detected leak — collapses to
    ``unsure``, never an exception and never partial/free-text output.
    """
    try:
        ask = Ask.model_validate(ask_raw)
    except Exception:
        return UNSURE.model_dump()
    hits = retrieve(ask.topic, journal, ask.window_days)
    raw = mock_model(ask, hits)
    return _validate(raw, hits).model_dump()
