/**
 * RecordsPanel — the structured-information section inside Memory.
 *
 * docs/PRODUCT-LANGUAGE.md draws the line this component keeps:
 *   RECORDS = user information (durable structured facts about you),
 *   VAULT   = security/secrets infrastructure (credentials, tokens)
 *             — relocated under Settings, and explicitly NOT here.
 * Records are not the friendly name for Vault, and the copy on this
 * screen says so where a person will read it.
 *
 * What the backend actually exposes for records today (verified
 * 2026-09-21 against src/personal_world/api.py:818 and
 * providers/native_memory.py): GET /api/memory/search — a query
 * over the station's own memory index, answering
 * `{ok, status, data:{results:[{id,kind,text,timestamp}], query,
 * count}}`, or ok:false + warnings when no memory provider exists.
 * There is NO list/detail CRUD for record categories yet, so this
 * panel renders exactly two honest doors: the search that is real,
 * and a plainly-labelled "no source yet" state for everything the
 * station does not expose. No fabricated records, no dead buttons.
 */

import { useState, type FormEvent } from "react";
import { useMemorySearch } from "../../data/hooks";
import { journalKindLabel } from "../../data/types";
import { WorldButton } from "../../components/WorldButton";
import { isRecord, strField } from "../Settings/parse";

// ─── Envelope parsing (runtime-checked, never cast) ──────

interface RecordHit {
  id: string;
  kind: string;
  text: string;
  timestamp: string | null;
}

/** data.results from /api/memory/search (native_memory.py shape).
 * Anything malformed degrades to "no results", never to invented
 * rows — the search already told the truth we can show. */
function parseRecordHits(data: unknown): RecordHit[] {
  if (!isRecord(data)) return [];
  const raw = data["results"];
  if (!Array.isArray(raw)) return [];
  const hits: RecordHit[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = strField(item, "id");
    const text = strField(item, "text");
    if (id === null || text === null) continue;
    hits.push({
      id,
      kind: strField(item, "kind") ?? "",
      text,
      timestamp: strField(item, "timestamp"),
    });
  }
  return hits;
}

function formatTs(ts: string | null): string {
  if (ts === null) return "";
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString();
}

// ─── Panel ────────────────────────────────────────────────

export function RecordsPanel() {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const search = useMemorySearch(query);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(inputValue.trim());
    // An emptied search box resets to the quiet intro state.
  };

  const envelope = search.data;
  const softFailure = search.isSuccess && envelope?.ok === false;
  const hits = softFailure ? [] : parseRecordHits(envelope?.data);
  // Soft failures ride the envelope: {ok:false, status, warnings} —
  // api.py's refusal shape; the first warning is the server's word.
  const warning = envelope?.warnings?.[0] ?? null;

  return (
    <section
      aria-labelledby="memory-records-heading"
      className="space-y-[var(--pw-spacing-lg)]"
    >
      <header>
        <h2
          id="memory-records-heading"
          className="text-[var(--pw-typography-size_h2)] font-semibold text-[var(--pw-text-primary)]"
        >
          Records
        </h2>
        <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Structured information this world keeps about you — durable,
          searchable, never invented. Records are not the Vault:
          credentials, tokens, and other secrets live in the Vault,
          under Settings.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-[var(--pw-spacing-md)]"
        role="search"
      >
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="memory-records-query"
            className="mb-[var(--pw-spacing-sm)] block text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
          >
            Search records
          </label>
          <input
            id="memory-records-query"
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="What do you remember storing?"
            className="w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          />
        </div>
        <WorldButton
          variant="primary"
          type="submit"
          isDisabled={search.isFetching}
          aria-label="Search the memory source"
        >
          {search.isFetching ? "Searching…" : "Search"}
        </WorldButton>
      </form>

      {/* Quiet intro — nothing is listed until asked, because there is
          no record-list endpoint and inventing rows is the one failure
          this panel must never commit. */}
      {query === "" && (
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Browsable record categories are not wired to a station source
          yet. Searching reads the memory index directly — with every
          model turned off, this stays a plain, deterministic query.
        </p>
      )}

      {query !== "" && search.isError && (
        <p
          role="alert"
          className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          The memory source did not answer.{" "}
          {search.error instanceof Error ? search.error.message : ""}
        </p>
      )}

      {query !== "" && softFailure && (
        <p role="note" className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          {warning ?? "No memory source is available on this station."}
        </p>
      )}

      {query !== "" && search.isSuccess && envelope?.ok !== false && hits.length === 0 && (
        <p
          aria-label="Empty state"
          className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]"
        >
          Nothing stored matches “{query}”.
        </p>
      )}

      {query !== "" && hits.length > 0 && (
        <section aria-label="Record results">
          <ul className="space-y-[var(--pw-spacing-md)]" role="list">
            {hits.map((hit) => (
              <li
                key={hit.id}
                className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
              >
                <p className="whitespace-pre-wrap text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
                  {hit.text}
                </p>
                <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                  {hit.kind !== "" ? journalKindLabel(hit.kind) : "Record"}
                  {hit.timestamp !== null && (
                    <>
                      {" · "}
                      <time dateTime={hit.timestamp}>{formatTs(hit.timestamp)}</time>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
