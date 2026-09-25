"""One voice with selectable tone registers (TRUE-NORTH § Voice, owner ruling 2026-09-22).

The product speaks with ONE default voice — the World's voice from
``docs/CHARACTER-HANDBOOK.md`` §10(1): calm, plain, warm, technically
honest — across chat and attention surfaces. What the person selects
is a *tone register* (``warm`` default · ``concise`` · ``playful`` ·
``formal``), persisted through the existing preferences schema
(``prefs.TONE``) and applied to model prompting here.

The residents and the two-voice system (CHARACTER-HANDBOOK §10(2),
``docs/COMPANION-CANON.md``) are preserved as an optional *personality
pack*: the ``personality_pack`` preference (default ``residents`` since
2026-09-25; the person can switch it ``off``) gates
whether the companion persona template rides along in the chat prompt.
Code and canon are kept, never deleted; only the routing is flagged.

Honesty floor is register-independent (PRODUCT-LANGUAGE.md principle 3:
warm in tone, exact in facts): a tone changes phrasing, never
exactness. Every tone instruction therefore carries the same truth
sentence, and the built-in identity floor in ``chat.build_chat_messages``
(truth rules, status vocabulary, never invent state) stays below it —
so no register, pack, or empty/malformed template tree can remove the
safety text. Degraded and model-off states are labeled honestly in
whatever tone is active; this module never produces a reply itself.
"""

from dataclasses import dataclass
from typing import Any

TONES = ("warm", "concise", "playful", "formal")
"""The starter tone-register set (TRUE-NORTH § Voice; owner reacts on
experience). Order is preference order, not rank: no tone is 'better'
or more accessible than another — they are phrasing registers over an
unchanged honesty floor."""

DEFAULT_TONE = "warm"

PACK_OFF = "off"
# Sol (companion key `personal-world`) is the Worlds mark and has no voice
# (owner, 2026-09-25): she never becomes a chat persona.
VOICELESS_COMPANIONS = frozenset({"personal-world"})
PACK_RESIDENTS = "residents"
"""Personality-pack vocabulary (prefs.PERSONALITY_PACK). ``off`` (the
default) speaks as the one Worlds voice; ``residents`` enables the
optional character crew (kept canon: CHARACTER-HANDBOOK.md,
COMPANION-CANON.md) as flavor on top of the same floor."""

# Each register's phrasing instruction. The shared truth sentence is
# appended by tone_instruction() so no register can drift away from it.
_TONE_INSTRUCTIONS: dict[str, str] = {
    "warm": (
        "Friendly, gentle, human cadence, ordinary words. Warmth never "
        "costs exactness: names, numbers, statuses, and uncertainty stay "
        "exactly as the context shows them, and a failure is said "
        "plainly and kindly — never softened into 'looks fine'."
    ),
    "concise": (
        "The shortest complete answer. Lead with the fact; drop "
        "pleasantries and filler. Never drop a status, number, caveat, "
        "or uncertainty the answer depends on."
    ),
    "playful": (
        "Light, friendly energy and gentle whimsy in phrasing. "
        "Playfulness never costs exactness, and serious things become "
        "plainer, not more theatrical."
    ),
    "formal": (
        "Measured, precise, professional prose; no slang or whimsy. "
        "State statuses and uncertainty plainly; never soften a failure."
    ),
}

_TRUTH_SENTENCE = (
    " This tone changes phrasing only: facts, statuses, and uncertainty "
    "stay exact, degraded and unavailable states are still labeled "
    "honestly, and the truth rules below are unchanged."
)


def tone_instruction(tone: str | None) -> str:
    """The prompt block for one tone register.

    Unknown, empty, or absent tones degrade to "" — the identity floor
    in ``chat.build_chat_messages`` (which is register-neutral) then
    speaks on its own, honestly, rather than with an invented register.
    """
    body = _TONE_INSTRUCTIONS.get(str(tone or ""))
    if body is None:
        return ""
    return f"Tone register: {tone}. {body}{_TRUTH_SENTENCE}"


@dataclass(frozen=True)
class VoiceSelection:
    """What the chat prompt speaks with, resolved from preferences.

    ``persona`` is the companion persona-template name (the residents /
    two-voice path) and is ``None`` unless the personality pack is on —
    the one voice is the default, not a fallback. ``tone`` is always a
    member of ``TONES``.
    """

    persona: str | None
    tone: str


def resolve_voice(pref_values: dict[str, Any] | None) -> VoiceSelection:
    """Resolve the active voice from (already normalized) preferences.

    Fail-safe in every branch: missing or malformed values land on the
    defaults (one voice, warm), never on an invented persona or tone.
    Accepts the output of ``prefs.get_prefs`` but does not trust it —
    callers may pass raw dicts.
    """
    values = pref_values if isinstance(pref_values, dict) else {}
    tone = str(values.get("tone") or DEFAULT_TONE)
    if tone not in TONES:
        tone = DEFAULT_TONE
    persona: str | None = None
    if str(values.get("personality_pack") or PACK_OFF) == PACK_RESIDENTS:
        # Pack ON: the historical residents path — the `companion`
        # preference names the persona template, exactly as before.
        persona = str(values.get("companion") or "") or None
        if persona in VOICELESS_COMPANIONS:
            persona = None
    return VoiceSelection(persona=persona, tone=tone)
