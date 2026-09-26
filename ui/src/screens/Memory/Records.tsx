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
 * What the backend exposes (verified 2026-09-21 against
 * src/personal_world/api.py records block + docs/RECORDS-API.md):
 *   GET    /api/records/categories        names + counts + locked flag
 *   GET    /api/records?category=<slug>   one category's records
 *          (locked category without fresh step-up → HTTP 409
 *           {ok:false, status:"locked"} — rendered here as a calm
 *           step-up invitation, never an error-red dead end)
 *   POST   /api/records                   create/update (step-up ACT)
 *   POST   /api/records/pin | /unpin      Overview pin (step-up ACT)
 *   DELETE /api/records                   delete (step-up ACT)
 * Every write consumes require_step_up; without the grant the server
 * answers 403 and this panel surfaces an honest "elevate first"
 * invitation (POST /api/auth/step-up re-presents the credential —
 * auth_routes.py). With no memory provider configured the whole
 * surface answers the soft envelope {ok:false, status:"unavailable",
 * warnings:["no memory provider"]} — shown plainly as "no source yet",
 * never as a fake-empty success.
 *
 * The search doors (GET /api/records?q= — the deterministic lexical
 * find, docs/RECORDS-API.md §Find — and GET /api/memory/search over
 * the station's memory index) are both plain, models-off queries:
 * browsing and searching are real doors, and AI is never the only one.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  useDeleteRecord,
  useMemorySearch,
  useRecordCategories,
  useRecordSearch,
  useRecordsInCategory,
  useSetRecordPinned,
  useStepUp,
  useWriteRecord,
} from "../../data/hooks";
import { describeError, isLockedRefusal, isStepUpGate } from "../../data/errors";
import { journalKindLabel } from "../../data/types";
import type { RecordCategoryRow, RecordItem } from "../../data/contract";
import { WorldButton } from "../../components/WorldButton";
import { isRecord, strField } from "../Settings/parse";

// ─── Screen-local input/button classes (same tokens Vault audited) ──

const BTN_PLAIN_SM =
  "inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium " +
  "transition-colors duration-150 motion-reduce:transition-none " +
  "min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] " +
  "px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] " +
  "bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] " +
  "border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)]";

const BTN_WARM =
  "inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium " +
  "transition-colors duration-150 motion-reduce:transition-none " +
  "min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] " +
  "px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] " +
  "bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)] " +
  "hover:brightness-110 active:brightness-90";

const BTN_CORAL =
  "inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium " +
  "transition-colors duration-150 motion-reduce:transition-none " +
  "min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] " +
  "px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] " +
  "bg-[var(--pw-accent-coral)] text-[var(--pw-surface-void)] " +
  "hover:brightness-110 active:brightness-90";

const INPUT_BASE =
  "w-full rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] " +
  "px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] " +
  "text-[var(--pw-text-primary)] min-h-[var(--pw-targets-minimum)] " +
  "focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";

// ─── Search-hit envelope parsing (runtime-checked, never cast) ──────

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

// ─── Step-up invitation (locked read 409 / write gate 403) ──────────
// Reuses the Settings StepUpNote idiom: calm, italic, role="note" —
// an invitation, not an alarm. The credential event it performs
// (POST /api/auth/step-up, auth_routes.py) is the real grant the
// server consumes; a wrong credential fails closed and the panel
// says exactly that, still in the same calm tone.

function StepUpInvite({
  reason,
  onElevated,
}: {
  reason: string;
  /** Called after a successful elevation (the ["records"]/["session"]
   * invalidation in useStepUp already re-reads the data). */
  onElevated?: () => void;
}) {
  const [token, setToken] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const stepUp = useStepUp();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setOutcome(null);
    if (token.trim() === "") {
      setOutcome("A credential is needed to step up — the station will not guess one.");
      return;
    }
    stepUp.mutate(token.trim(), {
      onSuccess: () => {
        // Never leave the credential lying in the field after the
        // grant is minted.
        setToken("");
        setOutcome(null);
        onElevated?.();
      },
      onError: (err) => {
        setOutcome(
          isStepUpGate(err)
            ? "That credential did not match this session — nothing changed."
            : describeError(err, "Step-up did not complete."),
        );
      },
    });
  };

  return (
    <section
      aria-label="Step up to continue"
      className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <p
        role="note"
        className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)] italic"
      >
        {reason}
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-[var(--pw-spacing-md)] flex flex-wrap items-end gap-[var(--pw-spacing-md)]"
      >
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="records-step-up-credential"
            className="mb-[var(--pw-spacing-sm)] block text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
          >
            Re-present your credential
          </label>
          <input
            id="records-step-up-credential"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={INPUT_BASE}
          />
        </div>
        <WorldButton variant="primary" type="submit" isDisabled={stepUp.isPending}>
          {stepUp.isPending ? "Stepping up…" : "Step up"}
        </WorldButton>
      </form>
      {outcome !== null && (
        <p
          role="alert"
          className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {outcome}
        </p>
      )}
    </section>
  );
}

// ─── Create / edit form ──────────────────────────────────────────────

interface FieldRow {
  key: string;
  value: string;
}

interface FormState {
  /** null when creating; the record's id when editing. */
  id: string | null;
  title: string;
  category: string;
  rows: FieldRow[];
  /** The lock checkbox — only SENT when it changes the category's
   * current flag (locking rides the record write; RECORDS-API §Locking). */
  locked: boolean;
  /** The category's stored lock at open time, or null for a brand-new
   * category (whose stored flag is by definition false). */
  originalLocked: boolean | null;
}

function recordToForm(rec: RecordItem): FormState {
  return {
    id: rec.id,
    title: rec.title,
    category: rec.category_name,
    rows: Object.entries(rec.fields).map(([key, value]) => ({
      key,
      value: value === null ? "" : String(value),
    })),
    // The lock half is filled by the caller from the category row —
    // it is category state, not record state.
    locked: false,
    originalLocked: null,
  };
}

function RecordForm({
  form,
  categories,
  onChange,
  onCancel,
  onSaved,
}: {
  form: FormState;
  categories: RecordCategoryRow[];
  onChange: (next: FormState) => void;
  onCancel: () => void;
  /** Successful write: the panel closes the form, selects the saved
   * category (slug from the server's reply, never guessed here), and
   * reports the save at list level. */
  onSaved: (title: string, slug: string | null) => void;
}) {
  const write = useWriteRecord();
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const editing = form.id !== null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  const setRow = (index: number, patch: Partial<FieldRow>) =>
    onChange({
      ...form,
      rows: form.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setGate(null);

    const title = form.title.trim();
    const category = form.category.trim();
    if (title === "") return setError("A title is required.");
    if (category === "") return setError("A category is required.");

    // A row with only one half filled is a mistake, not a field.
    const filled = form.rows.filter((r) => r.key.trim() !== "" || r.value.trim() !== "");
    if (filled.some((r) => r.key.trim() === "")) {
      return setError("Every field needs a name; remove the empty row instead.");
    }
    const keys = filled.map((r) => r.key.trim());
    if (new Set(keys).size !== keys.length) {
      return setError("Field names must be unique — nothing will be quietly overwritten.");
    }
    const fields: Record<string, string> = {};
    for (const r of filled) fields[r.key.trim()] = r.value;

    const body: Parameters<typeof write.mutate>[0] = {
      category,
      title,
      fields,
      ...(editing ? { id: form.id ?? undefined } : {}),
      // Locking is only meaningful (and only sent) as a CHANGE.
      ...(form.originalLocked !== null && form.locked !== form.originalLocked
        ? { locked: form.locked }
        : {}),
    };

    write.mutate(body, {
      onSuccess: (res) => {
        onSaved(title, res.data?.category ?? null);
      },
      onError: (err) => {
        // 403 = the step-up gate; show the door, not a dead end.
        if (isStepUpGate(err)) {
          setGate("This save needs step-up first — the write was not made.");
          return;
        }
        setError(describeError(err, "The record could not be saved."));
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={editing ? "Edit record" : "New record"}
      className="space-y-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h3 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
        {editing ? "Edit record" : "New record"}
      </h3>

      <div>
        <label
          htmlFor="records-form-title"
          className="mb-[var(--pw-spacing-sm)] block text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          Title
        </label>
        <input
          id="records-form-title"
          type="text"
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          maxLength={200}
          required
          className={INPUT_BASE}
        />
      </div>

      <div>
        <label
          htmlFor="records-form-category"
          className="mb-[var(--pw-spacing-sm)] block text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          Category
        </label>
        <input
          id="records-form-category"
          type="text"
          list="records-category-options"
          value={form.category}
          onChange={(e) => {
            const next = e.target.value;
            const match = categories.find(
              (c) => c.name === next || c.slug === next,
            );
            onChange({
              ...form,
              category: next,
              locked: match ? match.locked : false,
              originalLocked: match ? match.locked : null,
            });
          }}
          maxLength={80}
          required
          className={INPUT_BASE}
          placeholder="Medical · Work history · Emergency…"
        />
        <datalist id="records-category-options">
          {categories.map((c) => (
            <option key={c.slug} value={c.name} />
          ))}
        </datalist>
      </div>

      <fieldset className="space-y-[var(--pw-spacing-sm)]">
        <legend className="text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
          Fields
        </legend>
        {form.rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
            <label htmlFor={`records-field-key-${i}`} className="sr-only">
              Field {i + 1} name
            </label>
            <input
              id={`records-field-key-${i}`}
              type="text"
              value={row.key}
              onChange={(e) => setRow(i, { key: e.target.value })}
              maxLength={64}
              placeholder="name"
              className={`${INPUT_BASE} flex-1 min-w-[120px]`}
            />
            <label htmlFor={`records-field-value-${i}`} className="sr-only">
              Field {i + 1} value
            </label>
            <input
              id={`records-field-value-${i}`}
              type="text"
              value={row.value}
              onChange={(e) => setRow(i, { value: e.target.value })}
              maxLength={2000}
              placeholder="value"
              className={`${INPUT_BASE} flex-[2] min-w-[140px]`}
            />
            <button
              type="button"
              onClick={() =>
                onChange({ ...form, rows: form.rows.filter((_, j) => j !== i) })
              }
              className={BTN_PLAIN_SM}
              aria-label={`Remove field ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...form, rows: [...form.rows, { key: "", value: "" }] })}
          className={BTN_PLAIN_SM}
        >
          Add field
        </button>
      </fieldset>

      <label className="flex items-center gap-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
        <input
          type="checkbox"
          checked={form.locked}
          onChange={(e) => setField("locked", e.target.checked)}
          className="h-[var(--pw-spacing-lg)] w-[var(--pw-spacing-lg)] accent-[var(--pw-accent-primary)]"
        />
        Lock this category — reading it will require step-up
      </label>

      {(error !== null || gate !== null) && (
        <p
          role="alert"
          className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {error ?? gate}
        </p>
      )}

      {gate !== null && (
        <StepUpInvite
          reason="Records writes are the step-up ACT. Elevate this session, then save again — until then nothing was written."
          onElevated={() => setGate(null)}
        />
      )}

      <div className="flex flex-wrap gap-[var(--pw-spacing-md)]">
        <WorldButton variant="primary" type="submit" isDisabled={write.isPending}>
          {write.isPending ? "Saving…" : editing ? "Save record" : "Create record"}
        </WorldButton>
        <button type="button" onClick={onCancel} className={BTN_PLAIN_SM}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Record card ─────────────────────────────────────────────────────

function RecordCard({
  record,
  onEdit,
  onDelete,
}: {
  record: RecordItem;
  onEdit: () => void;
  onDelete: (trigger: HTMLElement) => void;
}) {
  const pinToggle = useSetRecordPinned();
  const [actionError, setActionError] = useState<string | null>(null);
  const entries = Object.entries(record.fields);

  return (
    <li className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--pw-spacing-md)]">
        <h4 className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">
          {record.title}
        </h4>
        {record.pinned && (
          <span className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-2 py-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
            Pinned to Overview
          </span>
        )}
      </div>
      {entries.length > 0 ? (
        <dl className="mt-[var(--pw-spacing-sm)] space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)]">
              <dt className="font-medium text-[var(--pw-text-secondary)]">{key}</dt>
              <dd className="min-w-0 flex-1 break-words text-[var(--pw-text-primary)]">
                {value === null ? "—" : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          No fields stored on this record.
        </p>
      )}
      <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
        {record.category_name}
        {" · updated "}
        <time dateTime={record.updated}>{formatTs(record.updated)}</time>
      </p>
      <div className="mt-[var(--pw-spacing-md)] flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            pinToggle.mutate(
              { category: record.category, id: record.id, pinned: !record.pinned },
              {
                onError: (err) =>
                  setActionError(
                    isStepUpGate(err)
                      ? "Pinning needs step-up first — the record is unchanged."
                      : describeError(err, "The pin could not be changed."),
                  ),
              },
            );
          }}
          disabled={pinToggle.isPending}
          className={BTN_PLAIN_SM}
          aria-label={`${record.pinned ? "Unpin" : "Pin"} record ${record.title}`}
        >
          {record.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={BTN_PLAIN_SM}
          aria-label={`Edit record ${record.title}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={(e) => onDelete(e.currentTarget)}
          className={`${BTN_CORAL} text-[var(--pw-surface-void)]`}
          aria-label={`Delete record ${record.title}`}
        >
          Delete
        </button>
      </div>
      {actionError !== null && (
        <p
          role="alert"
          className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {actionError}
        </p>
      )}
    </li>
  );
}

// ─── Panel ────────────────────────────────────────────────

export function RecordsPanel() {
  // Search doors (both deterministic, both models-off — see the block
  // comment at the form): the records find (?q=) and the memory index.
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const search = useMemorySearch(query);
  const recordSearch = useRecordSearch(query);

  // Browse door — categories → records
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gateNotice, setGateNotice] = useState<string | null>(null);

  const categoriesQuery = useRecordCategories();
  const recordsQuery = useRecordsInCategory(selected);
  const deleteMutation = useDeleteRecord();

  const categoriesEnvelope = categoriesQuery.data;
  // Degraded = the capability-grid truth: no memory provider on this
  // station. Envelope data, not a query error (the server answers 200
  // + ok:false). Render it plainly — never a fake-empty success.
  const degraded = categoriesEnvelope?.ok === false;
  const degradedWarning = categoriesEnvelope?.warnings?.[0] ?? null;
  const categories = degraded ? [] : categoriesEnvelope?.data?.categories ?? [];
  const selectedRow = categories.find((c) => c.slug === selected) ?? null;

  // Delete confirmation — native <dialog> with showModal() (§3.3),
  // the same idiom the Vault tool established: modal, focus trapped,
  // Escape cancels (the safe action), focus returns to the trigger.
  const [deleteTarget, setDeleteTarget] = useState<RecordItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (deleteTarget) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
      const trigger = triggerRef.current;
      triggerRef.current = null;
      trigger?.focus();
    }
  }, [deleteTarget]);

  function confirmDelete() {
    if (!deleteTarget) return;
    const { category, id, title } = deleteTarget;
    deleteMutation.mutate(
      { category, id },
      {
        onSuccess: () => {
          setNotice(`Record “${title}” deleted. Nothing about it stays in this world's records.`);
          setGateNotice(null);
        },
        onError: (err) => {
          setNotice(
            isStepUpGate(err)
              ? "Deleting needs step-up first — the record is unchanged."
              : describeError(err, "The record could not be deleted."),
          );
          setGateNotice(isStepUpGate(err) ? "delete" : null);
        },
        onSettled: () => setDeleteTarget(null),
      },
    );
  }

  const openCreate = (category?: RecordCategoryRow) => {
    setNotice(null);
    setGateNotice(null);
    setForm({
      id: null,
      title: "",
      category: category?.name ?? selectedRow?.name ?? "",
      rows: [{ key: "", value: "" }],
      locked: category?.locked ?? selectedRow?.locked ?? false,
      originalLocked: category ? category.locked : selectedRow ? selectedRow.locked : null,
    });
  };

  const openEdit = (record: RecordItem) => {
    setNotice(null);
    setGateNotice(null);
    const base = recordToForm(record);
    setForm({
      ...base,
      locked: selectedRow?.locked ?? false,
      originalLocked: selectedRow ? selectedRow.locked : null,
    });
  };

  const lockedRefusal = recordsQuery.isError && isLockedRefusal(recordsQuery.error);
  const recordsError =
    recordsQuery.isError && !lockedRefusal
      ? describeError(recordsQuery.error, "The records source did not answer.")
      : null;
  const records = recordsQuery.data?.data?.records ?? [];

  return (
    <section
      aria-labelledby="memory-records-heading"
      className="space-y-[var(--pw-spacing-lg)]"
    >
      <header>
        <h2
          id="memory-records-heading"
          className="text-[length:var(--pw-typography-size_h2)] font-semibold text-[var(--pw-text-primary)]"
            style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
        >
          Records
        </h2>
        <p className="mt-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Structured information this world keeps about you — durable,
          searchable, never invented. Records are not the Vault:
          credentials, tokens, and other secrets live in the Vault,
          under Settings.
        </p>
      </header>

      {/* ── Categories: the browsable half of Memory ─────────────── */}
      <section aria-label="Record categories" className="space-y-[var(--pw-spacing-md)]">
        <div className="flex flex-wrap items-center justify-between gap-[var(--pw-spacing-md)]">
          <h3 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
            Categories
          </h3>
          <button
            type="button"
            onClick={() => openCreate()}
            className={BTN_WARM}
            aria-label="Add record"
          >
            Add record
          </button>
        </div>

        {categoriesQuery.isPending && (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Loading…
          </p>
        )}

        {categoriesQuery.isError && (
          <p
            role="alert"
            className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
          >
            The records source did not answer.{" "}
            {describeError(categoriesQuery.error, "")}
          </p>
        )}

        {degraded && (
          /* Honest degradation, per the contract: with no memory
             provider the whole Records surface has no source — say
             the server's word, invent nothing. */
          <p role="note" className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            No source yet for records on this station —{" "}
            {degradedWarning ?? "the memory capability is not configured"}.
            Names, counts, and contents will appear as soon as a
            provider backs them.
          </p>
        )}

        {!degraded && !categoriesQuery.isPending && !categoriesQuery.isError && categories.length === 0 && (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            No record categories yet — this world holds none. Creating
            the first record makes one.
          </p>
        )}

        {categories.length > 0 && (
          <ul role="list" className="grid grid-cols-1 gap-[var(--pw-spacing-sm)] sm:grid-cols-2">
            {categories.map((cat) => {
              const isSelected = cat.slug === selected;
              return (
                <li key={cat.slug}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelected(cat.slug);
                      setForm(null);
                      setNotice(null);
                      setGateNotice(null);
                    }}
                    className={`w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-md)] border p-[var(--pw-spacing-md)] text-left transition-colors motion-reduce:transition-none focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)] ${
                      isSelected
                        ? "border-[var(--pw-accent-primary)] bg-[var(--pw-surface-elevated)]"
                        : "border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] hover:bg-[var(--pw-surface-elevated)]"
                    }`}
                    aria-label={`Category ${cat.name}`}
                  >
                    <span className="flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
                      <span className="text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
                        {cat.name}
                      </span>
                      {cat.locked && (
                        /* Word first, glyph as adornment — status is
                           never carried by color or icon alone (§2.2). */
                        <span className="inline-flex items-center gap-1 rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-2 py-[2px] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                          <span aria-hidden="true">🔒</span> Locked
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                      {cat.count === 1 ? "1 record" : `${cat.count} records`}
                      {cat.pinned > 0 &&
                        ` · ${cat.pinned} pinned to Overview`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!selectedRow && !degraded && categories.length > 0 && !categoriesQuery.isPending && !categoriesQuery.isError && (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Pick a category to browse its records.
          </p>
        )}
      </section>

      {/* ── Selected category: records, invitation, or honest state ─ */}
      {selectedRow !== null && !degraded && (
        <section
          aria-label={`Records in ${selectedRow.name}`}
          className="space-y-[var(--pw-spacing-md)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-[var(--pw-spacing-sm)]">
            <h3 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
              {selectedRow.name}
            </h3>
            <button
              type="button"
              onClick={() => openCreate(selectedRow)}
              className={BTN_PLAIN_SM}
              aria-label={`Add record to ${selectedRow.name}`}
            >
              Add record here
            </button>
          </div>

          {recordsQuery.isPending && (
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              Loading…
            </p>
          )}

          {lockedRefusal && (
            /* The 409 envelope is a DOOR, not a dead end: the
               category's name, count, and locked flag were disclosed
               above precisely so a person knows what to unlock. */
            <StepUpInvite
              reason={
                (recordsQuery.error instanceof Error &&
                recordsQuery.error.message !== ""
                  ? recordsQuery.error.message
                  : `Category '${selectedRow.slug}' is locked: step-up required to read`) +
                ". Its name, count, and lock stay visible without elevation; the contents appear the moment you do."
              }
              onElevated={() => {
                void recordsQuery.refetch();
              }}
            />
          )}

          {recordsError !== null && (
            <p
              role="alert"
              className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
            >
              {recordsError}
            </p>
          )}

          {gateNotice !== null && lockedRefusal === false && (
            <StepUpInvite
              reason="That action was refused: it needs step-up, and the station made no change. Elevate below, then try again."
              onElevated={() => setGateNotice(null)}
            />
          )}

          {!recordsQuery.isPending && !recordsQuery.isError && records.length === 0 && (
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              This category holds no records yet — a true zero, not a
              missing source. Add the first one above.
            </p>
          )}

          {records.length > 0 && (
            <ul role="list" className="space-y-[var(--pw-spacing-md)]">
              {records.map((rec) => (
                <RecordCard
                  key={rec.id}
                  record={rec}
                  onEdit={() => openEdit(rec)}
                  onDelete={(trigger) => {
                    triggerRef.current = trigger;
                    setDeleteTarget(rec);
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Create / edit form ────────────────────────────────────── */}
      {form !== null && (
        <RecordForm
          form={form}
          categories={categories}
          onChange={setForm}
          onCancel={() => setForm(null)}
          onSaved={(title, slug) => {
            setForm(null);
            if (slug !== null) setSelected(slug);
            setNotice(`Record “${title}” saved in ${slug ?? "the chosen category"}.`);
            setGateNotice(null);
          }}
        />
      )}

      {notice !== null && (
        <p
          role="status"
          aria-live="polite"
          className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {notice}
        </p>
      )}

      {/* ── Search doors — TWO deterministic finds, both models-off ──
           G-memory (TRUE-NORTH): "pin + find a record with all models
           off". Door 1 is the records find (GET /api/records?q= —
           lexical AND-substring over title/category/fields, computed
           by the server with no index, provider, or model). Door 2 is
           the journal/memory index (GET /api/memory/search — native
           SQLite FTS5). Both always render when a query is active,
           each with its own honest state, so the layout is the same
           place every time. AI may recall conversationally (Chat);
           it is never the only door. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(inputValue.trim());
        }}
        className="flex flex-wrap items-end gap-[var(--pw-spacing-md)]"
        role="search"
      >
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="memory-records-query"
            className="mb-[var(--pw-spacing-sm)] block text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
          >
            Search records
          </label>
          <input
            id="memory-records-query"
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="What do you remember storing?"
            className="w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          />
        </div>
        <WorldButton
          variant="primary"
          type="submit"
          isDisabled={recordSearch.isFetching || search.isFetching}
          aria-label="Search Memory"
        >
          {recordSearch.isFetching || search.isFetching ? "Searching…" : "Search"}
        </WorldButton>
      </form>

      {query === "" && (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Searching reads your records and the memory index directly —
          with every model turned off, both stay plain, deterministic
          queries.
        </p>
      )}

      {query !== "" && (
        <section
          aria-label="Matching records"
          className="space-y-[var(--pw-spacing-md)]"
        >
          <h3 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
            Matching records
          </h3>

          {recordSearch.isPending && (
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              Loading…
            </p>
          )}

          {recordSearch.isError && (
            <p
              role="alert"
              className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
            >
              The records source did not answer.{" "}
              {describeError(recordSearch.error, "")}
            </p>
          )}

          {recordSearch.isSuccess && recordSearch.data?.ok === false && (
            /* The server's own word (usually "no memory provider"),
               plainly — never a fake-empty success. */
            <p role="note" className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              {recordSearch.data.warnings?.[0] ??
                "No source is available for records on this station."}
            </p>
          )}

          {recordSearch.isSuccess &&
            recordSearch.data?.ok !== false &&
            (recordSearch.data?.data?.records ?? []).length === 0 && (
              <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                No records match “{query}” — a true zero from this
                world's own records.
              </p>
            )}

          {recordSearch.isSuccess &&
            recordSearch.data?.ok !== false &&
            (recordSearch.data?.data?.records ?? []).length > 0 && (
              <ul className="space-y-[var(--pw-spacing-md)]" role="list">
                {(recordSearch.data?.data?.records ?? []).map((rec) => (
                  <li
                    key={rec.id}
                    className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-[var(--pw-spacing-md)]">
                      <h4 className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">
                        {rec.title}
                      </h4>
                      {rec.pinned && (
                        <span className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-2 py-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                          Pinned to Overview
                        </span>
                      )}
                    </div>
                    <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                      {rec.category_name}
                      {" · updated "}
                      <time dateTime={rec.updated}>{formatTs(rec.updated)}</time>
                    </p>
                    {/* One route to the record's actions: its category
                        view (no duplicated pin/edit semantics here). */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(rec.category);
                        setForm(null);
                        setNotice(null);
                        setGateNotice(null);
                      }}
                      className={`${BTN_PLAIN_SM} mt-[var(--pw-spacing-md)]`}
                      aria-label={`Open category ${rec.category_name} for record ${rec.title}`}
                    >
                      Open category
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}

      {query !== "" && (
        <section
          aria-label="Journal and memory index results"
          className="space-y-[var(--pw-spacing-md)]"
        >
          <h3 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
            Journal &amp; memory index
          </h3>

          {search.isError && (
            <p
              role="alert"
              className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
            >
              The memory source did not answer.{" "}
              {search.error instanceof Error ? search.error.message : ""}
            </p>
          )}

          {search.isSuccess && search.data?.ok === false && (
            <p role="note" className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              {search.data.warnings?.[0] ?? "No memory source is available on this station."}
            </p>
          )}

          {search.isSuccess &&
            search.data?.ok !== false &&
            parseRecordHits(search.data?.data).length === 0 && (
              <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                Nothing indexed matches “{query}”.
              </p>
            )}

          {search.isSuccess && parseRecordHits(search.data?.data).length > 0 && (
            <ul className="space-y-[var(--pw-spacing-md)]" role="list">
              {parseRecordHits(search.data?.data).map((hit) => (
                <li
                  key={hit.id}
                  className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
                >
                  <p className="whitespace-pre-wrap text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
                    {hit.text}
                  </p>
                  <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
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
          )}
        </section>
      )}

      {/* Delete confirmation — native modal dialog (§3.3), same
          discipline as the Vault tool: Escape cancels, the safe
          action is first, the record survives until Confirm. */}
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby="records-delete-title"
        aria-describedby="records-delete-desc"
        onClick={(e) => {
          if (e.target === dialogRef.current) setDeleteTarget(null);
        }}
        onCancel={(e) => {
          // Escape — cancel is the safe action: nothing deleted.
          e.preventDefault();
          setDeleteTarget(null);
        }}
        className="hidden open:grid fixed inset-0 z-50 m-0 h-full max-h-full w-full max-w-full place-items-center bg-black/60 pt-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-top))] pr-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-right))] pb-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-bottom))] pl-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-left))] text-[var(--pw-text-primary)]"
      >
        <div className="w-full max-w-md rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-xl)] mx-[var(--pw-spacing-xl)]">
          <h3
            id="records-delete-title"
            className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]"
          >
            Delete record
          </h3>
          <p
            id="records-delete-desc"
            className="mt-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
          >
            Are you sure you want to delete{" "}
            <span className="font-medium text-[var(--pw-text-primary)]">
              {deleteTarget?.title ?? ""}
            </span>
            ? This cannot be undone.
          </p>
          <div className="mt-[var(--pw-spacing-xl)] flex justify-end gap-[var(--pw-spacing-md)]">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className={BTN_PLAIN_SM}
              aria-label="Cancel delete"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className={`${BTN_CORAL} disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={`Confirm delete record ${deleteTarget?.title ?? ""}`}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
