/**
 * SettingsRoom — the manifest-truth settings renderer (C1) with
 * undo-visible writes (C2).
 *
 * Nothing here is hand-listed: the renderable settings surface comes
 * from the server's own vocabulary — `GET /api/prefs/schema` answers
 * exactly the keys, types and allowed values `prefs.set_prefs` accepts
 * (src/personal_world/prefs.py). A key the server does not describe is
 * not offered; a value outside the server's `allowed` list can never
 * be offered either, because the select can only show server-legal
 * values.
 *
 * C2 discipline — nothing auto-persists:
 *   · editing a control only builds a local draft;
 *   · every draft difference from the server value renders as an
 *     explicit "old → proposed" change line with its own keyboard-
 *     operable Undo button, plus a Revert-all escape;
 *   · the single write path is the Apply button, which sends ONLY the
 *     changed keys; after a successful apply the change list is shown
 *     again ("Applied: …") so what persisted stays visible.
 *
 * Read-only honesty: a setting whose write endpoint the station does
 * not expose (or has not granted: PUT /api/prefs is step-up gated) is
 * shown read-only with a plain sentence why — never as a fake
 * editable control.
 *
 * Accessibility floor (docs/accessibility/ACCESSIBILITY_CONTRACT.md):
 * §2.1 ≥44px targets · §2.2 keyboard-only operable · §2.4 focus ring
 * via the composed global `:focus-visible` rule (world.css) plus
 * explicit per-control outline classes · §2.5 source order · §1.3
 * state in words · §1.5 static loading text · §6.2 motion is only
 * colour transitions, disabled under prefers-reduced-motion.
 */

import { useCallback, useMemo, useState } from "react";
import {
  useCrew,
  usePrefs,
  usePrefsSchema,
  usePutPrefs,
  useSession,
} from "../../data/hooks";
import { describeError } from "../../data/errors";
import type { PrefsUpdateRequest } from "../../data/contract";
import { WorldButton } from "../../components/WorldButton";
import { applyPrefsToDocument } from "../../app/prefs-dom";
import {
  WARMTH_UNWIRED,
  WARMTH_UNWIRED_LABEL,
} from "../../language/warmth";

// ─── Server-vocabulary types + parsers live in ./parse.ts (Fast
// ─── Refresh rule: component files export components only). ───

import {
  companionPatchValue,
  diffPrefs,
  isRecord,
  NO_COMPANION,
  parsePrefsSchema,
  prefKeyLabel,
  prefValueLabel,
  readPrefsValues,
  type PrefsChange,
  type PrefsSchemaEntry,
  type PrefsValue,
} from "./parse";

const CONTROL_CLASS =
  "w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] " +
  "rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] " +
  "text-[var(--pw-text-primary)] text-[length:var(--pw-typography-size_body)] " +
  "focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";

const LABEL_CLASS =
  "block mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] font-medium " +
  "text-[var(--pw-text-primary)]";

// ─── One typed control per schema entry ──────────────────────────────

function PrefsControl({
  entry,
  value,
  onChange,
}: {
  entry: PrefsSchemaEntry;
  value: PrefsValue;
  onChange: (next: PrefsValue) => void;
}) {
  const id = `settings-room-${entry.key}`;
  const hintId = `${id}-hint`;
  const controlId = `${id}-control`;

  if (entry.type === "number" && entry.allowed === null) {
    // Open numeric range: a real number input bounded at the server's
    // floor. The server still validates; a below-floor value is
    // rejected with its own reason line, never silently clamped.
    return (
      <div className="mb-[var(--pw-spacing-lg)]">
        <label htmlFor={controlId} className={LABEL_CLASS}>
          {prefKeyLabel(entry.key)}
        </label>
        <input
          id={controlId}
          type="number"
          inputMode="decimal"
          min={entry.floor}
          step={entry.integer ? 1 : "any"}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          aria-describedby={hintId}
          className={CONTROL_CLASS}
        />
        <p id={hintId} className="mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
          Minimum {String(entry.floor)}
          {entry.unit} — set by the accessibility floor, never offered below it.
        </p>
      </div>
    );
  }

  const options = (entry.allowed ?? []).map((option) => ({
    value: option,
    label: prefValueLabel(entry, option),
  }));
  // A current value outside allowed() (a server change mid-session) is
  // shown as its own option rather than silently rewritten.
  if (!options.some((o) => String(o.value) === String(value))) {
    options.unshift({ value, label: `${prefValueLabel(entry, value)} (current)` });
  }

  return (
    <div className="mb-[var(--pw-spacing-lg)]">
      <label htmlFor={controlId} className={LABEL_CLASS}>
        {prefKeyLabel(entry.key)}
      </label>
      <select
        id={controlId}
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const next =
            entry.type === "number"
              ? Number(raw)
              : raw;
          onChange(next);
        }}
        aria-describedby={hintId}
        className={CONTROL_CLASS}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <p id={hintId} className="mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
        {entry.key === "tone" ? (
          /* Voice prefs are comfort, not accessibility — no floor
             wording, and the honesty rule stated plainly instead
             (TRUE-NORTH § Voice). */
          <>
            How the one Worlds voice phrases chat replies and attention
            labels. Facts, statuses, and uncertainty stay exact in every
            tone, and degraded states are always labeled honestly.
          </>
        ) : entry.key === "personality_pack" ? (
          <>
            “Residents” (the default) adds the character crew as flavor
            on top of the one Worlds voice; Off speaks plainly. The truth
            rules are identical either way.
          </>
        ) : entry.key === "companion_id" ? (
          <>
            Who keeps you company in chat and on Overview. The Assistant
            is the plain voice with a friendly screen for a face. A
            companion changes how things are phrased, never what’s true.
          </>
        ) : (
          <>
            Floor: {prefValueLabel(entry, entry.floor)}
            {entry.key === "target_size" && " (44px minimum — WCAG 2.5.5)"}
            {entry.key === "motion" && " — your system's reduced-motion setting always wins over this."}
            {/* Read-only honesty for the one stored key this surface does
                not render through (C12): saying so beats faking an effect. */}
            {entry.key === "accent" && " — the station stores this; no view here changes its look yet."}
          </>
        )}
      </p>
    </div>
  );
}

// ─── The room ─────────────────────────────────────────────────────────

export function SettingsRoom() {
  const prefsQuery = usePrefs();
  const schemaQuery = usePrefsSchema();
  const sessionQuery = useSession();
  const putPrefs = usePutPrefs();

  const crewQuery = useCrew();
  const parsedSchema = useMemo(() => {
    const parsed = parsePrefsSchema(schemaQuery.data);
    // The companion row's choices are the person's own crew (hidden
    // companions left out; the server refuses them anyway).
    const crew = (crewQuery.data?.data ?? []).filter((c) => !c.hidden);
    return {
      ...parsed,
      entries: parsed.entries.map((entry) =>
        entry.key === "companion_id"
          ? {
              ...entry,
              allowed: [NO_COMPANION, ...crew.map((c) => c.id)],
              labels: Object.fromEntries(crew.map((c) => [c.id, c.name])),
            }
          : entry,
      ),
    };
  }, [schemaQuery.data, crewQuery.data]);
  const serverValues = useMemo(
    () => readPrefsValues(prefsQuery.data, parsedSchema.entries),
    [prefsQuery.data, parsedSchema.entries],
  );

  // C2: the draft is a local overlay {key → proposed}. The server is
  // not told anything until Apply is pressed, and Apply sends only the
  // overlay entries that actually differ.
  const [draft, setDraft] = useState<Record<string, PrefsValue> | null>(null);
  const effective = useMemo(
    () => ({ ...serverValues, ...(draft ?? {}) }),
    [serverValues, draft],
  );
  const changes = diffPrefs(serverValues, effective);

  const [note, setNote] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [lastApplied, setLastApplied] = useState<PrefsChange[]>([]);

  const hasStepUp = sessionQuery.data?.data?.has_step_up === true;
  const stepUpKnown = !sessionQuery.isPending && !sessionQuery.isError;

  const setValue = useCallback(
    (key: string, value: PrefsValue) =>
      setDraft((prev) => ({ ...(prev ?? {}), [key]: value })),
    [],
  );

  const undoChange = useCallback(
    (key: string) =>
      setDraft((prev) => {
        const overlay = { ...(prev ?? {}) };
        delete overlay[key];
        return Object.keys(overlay).length === 0 ? null : overlay;
      }),
    [],
  );

  const revertAll = useCallback(() => setDraft(null), []);

  const applyChanges = useCallback(() => {
    setNote(null);
    const patch: Record<string, PrefsValue | null> = {};
    for (const change of changes) patch[change.key] = companionPatchValue(change.key, change.to);
    // The patch keys are server-driven (GET /api/prefs/schema) and
    // validated server-side (set_prefs rejects anything else with a
    // 400 + reason) — this body is a runtime vocabulary, not a
    // statically-keyed object, so it crosses the boundary once, here.
    putPrefs.mutate(patch as PrefsUpdateRequest, {
      onSuccess: (res) => {
        setDraft(null);
        setLastApplied(changes);
        setNote({
          text: `Saved ${changes.length === 1 ? "1 setting" : `${changes.length} settings`}.`,
          tone: "ok",
        });
        // C12 — the applied values must actually LAND on the surface.
        // PUT /api/prefs answers with the full effective table (api.py
        // returns set_prefs' result), so the write response is server
        // truth; apply it now instead of waiting for the invalidated
        // GET. An unrecognisable body changes no DOM (never a guess).
        if (isRecord(res) && isRecord(res["data"])) {
          applyPrefsToDocument(readPrefsValues(res, parsedSchema.entries));
        }
      },
      onError: (err) =>
        setNote({
          text: describeError(err, "Could not save the settings."),
          tone: "error",
        }),
    });
  }, [changes, putPrefs, parsedSchema.entries]);

  // ── Honest states (§1.5: static, worded) ──
  if (prefsQuery.isPending || schemaQuery.isPending) {
    return (
      <section aria-labelledby="settings-room-heading" className="mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
        <h2 id="settings-room-heading" className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-secondary)]">
          Customize
        </h2>
        <p role="status" className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Loading…
        </p>
      </section>
    );
  }

  if (
    schemaQuery.isError ||
    parsedSchema.entries.length === 0
  ) {
    return (
      <section aria-labelledby="settings-room-heading" className="mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
        <h2 id="settings-room-heading" className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-secondary)]">
          Customize
        </h2>
        <p role="alert" className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          {schemaQuery.isError
            ? "The station could not describe its settings, so nothing is offered for editing here. Nothing has been changed."
            : "The station reported no renderable settings. Nothing is offered, and nothing has been changed."}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="settings-room-heading"
      className="mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h2
        id="settings-room-heading"
        className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-secondary)]"
      >
        Customize
      </h2>
      {/* §9.2: these preferences tune an already-accessible product. */}
      <p className="mb-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Every value below comes from the station itself — the options shown are the
        options the server accepts. Nothing saves until you apply it.
      </p>

      {/* A setting we cannot describe faithfully is shown READ-ONLY with
          a plain sentence why — never as a fake editable control. */}
      {parsedSchema.rejectedKeys.map((key) => (
        <div
          key={key}
          className="mb-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-md)]"
        >
          <p className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
            {prefKeyLabel(key)}
          </p>
          <p className="mt-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Read-only: the station described this setting in a shape this view
            does not understand, and showing a guessed control would be worse
            than showing none.
          </p>
        </div>
      ))}

      {parsedSchema.entries.map((entry) => (
        <PrefsControl
          key={entry.key}
          entry={entry}
          value={effective[entry.key]}
          onChange={(next) => setValue(entry.key, next)}
        />
      ))}

      {/* C2 — undo-visible preview. One line per change, each with its
          own keyboard-operable Undo; nothing here persists. */}
      {changes.length > 0 && (
        <div
          aria-labelledby="settings-room-changes-heading"
          className="mb-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-accent-primary)] p-[var(--pw-spacing-md)]"
        >
          <h3
            id="settings-room-changes-heading"
            className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]"
          >
            Waiting to be applied ({changes.length})
          </h3>
          <ul role="list" className="space-y-[var(--pw-spacing-sm)]">
            {changes.map((change) => {
              const entry =
                parsedSchema.entries.find((e) => e.key === change.key) ?? null;
              return (
                <li
                  key={change.key}
                  className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]"
                >
                  <span className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
                    {/* One sentence, one text node: the whole change
                        reads at once by screen reader and by test. */}
                    {`${prefKeyLabel(change.key)}: ${
                      entry ? prefValueLabel(entry, change.from) : String(change.from)
                    } → ${
                      entry ? prefValueLabel(entry, change.to) : String(change.to)
                    }`}
                  </span>
                  <WorldButton
                    variant="ghost"
                    type="button"
                    onPress={() => undoChange(change.key)}
                    aria-label={`Undo change to ${prefKeyLabel(change.key)}`}
                    className="!min-h-[var(--pw-targets-minimum)]"
                  >
                    Undo
                  </WorldButton>
                </li>
              );
            })}
          </ul>
          <WorldButton
            variant="secondary"
            type="button"
            onPress={revertAll}
            className="mt-[var(--pw-spacing-md)]"
          >
            Revert all changes
          </WorldButton>
        </div>
      )}

      {lastApplied.length > 0 && changes.length === 0 && (
        <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          <span>
            {`Last apply changed ${lastApplied.length} ${
              lastApplied.length === 1 ? "setting" : "settings"
            }: ${lastApplied
              .map((c) => `${prefKeyLabel(c.key).toLowerCase()} ${String(c.from)}→${String(c.to)}`)
              .join(" · ")}`}
          </span>
        </p>
      )}

      <WorldButton
        variant="primary"
        type="button"
        onPress={applyChanges}
        isDisabled={changes.length === 0 || putPrefs.isPending || !hasStepUp}
      >
        {putPrefs.isPending
          ? "Saving…"
          : `Apply changes${changes.length ? ` (${changes.length})` : ""}`}
      </WorldButton>
      <span className="ml-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Nothing is saved until this button is pressed.
      </span>

      {/* Read-only honesty: the write gate is server truth. */}
      {!hasStepUp && (
        <p className="mt-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          {stepUpKnown
            ? "Read-only right now: saving settings requires re-authentication (step-up), which this session has not been granted. The values above can still be previewed; the station will not accept the write."
            : "Read-only right now: this view cannot confirm whether saving is permitted in this session, so Apply stays unavailable rather than pretending."}
        </p>
      )}

      {note && (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {note.text}
        </p>
      )}

      {/* C10 — the one discoverable home of the honest unwired label.
          Settings preview panel only; never scattered. */}
      <h3 className="mt-[var(--pw-spacing-xl)] mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]">
        Language dials
      </h3>
      {WARMTH_UNWIRED ? (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          {WARMTH_UNWIRED_LABEL}. The shape is decided (job, up to two context
          tags, low-bandwidth, warmth 1–7); no station message is rendered
          through it yet, and no control here changes anything.
        </p>
      ) : (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Language dials are wired — controls appear above.
        </p>
      )}
    </section>
  );
}
