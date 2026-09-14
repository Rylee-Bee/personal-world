import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  addReminder,
  deleteReminder,
  fetchPrefs,
  fetchPrefsSchema,
  fetchReminders,
  fetchSections,
  fetchWorldStatus,
  savePrefsPartial,
  saveSections,
  toggleReminder,
  type PrefSchemaEntry,
  type PrefsSchema,
  type Reminder,
  type SectionData,
  type WorldStatus,
  type BrainTemplate,
} from "../lib/api";
import { useCompanion, COMPANIONS } from "../lib/companion-context";
import { usePrefs, COMPANION_OFF, companionChoices } from "../lib/prefs-context";
import { usePrincipal, useSectionsWrite, useApps, useThemes, useBrainTemplates, useChatProviders } from "../lib/hooks";
import { savePrincipalDisplayName } from "../lib/api";
import { ConnectionsPanel } from "./ConnectionsPanel";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { Dialog } from "../primitives/Dialog";
import { Disclosure } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { Icon, sectionIconToShimName, type IconName } from "../lib/icons";
import "./settings-screen.css";

/**
 * Settings screen (P1 T11, FOUNDATION-SPEC §10 row T11 / parity row 6).
 *
 * Every control renders FROM server truth:
 *   - prefs from GET /api/prefs/schema (options are the server's
 *     vocabulary, never hard-coded; writes via PUT /api/prefs with the
 *     server's 400 detail surfaced VERBATIM per field);
 *   - the companion list from the schema's companion entry (prefs.py
 *     COMPANION vocabulary) plus the frontend-only "off" entry
 *     (prefs-context: rendering machinery, not server truth);
 *   - the sections panel from GET /api/sections with Move up/Move
 *     down/Hide/Show and "Restore default sections" (PUT /api/sections;
 *     settings is pinned server-side and shows NO Hide control);
 *   - reminders from GET /api/reminders (POST/PATCH/DELETE, step-up);
 *   - the capability table from GET /api/status capabilities, rendered
 *     as StatusChip words (canonical status.py vocabulary only; a null
 *     status renders the honest "unknown" word — the canonical word —
 *     with no invented status and no tint).
 *
/**
 * The shell (T9 AppShell) owns <main> and the nav — and, since the T14
 * human-gate correction, the ONE content measure (index.css .pw-main
 * --pw-content-measure); this screen renders bare inside it. All
 * targets are ≥44px via --pw-target-minimum; no hex (token vars only);
 * destructive confirms use the danger Dialog.
 */

// ── Small local styles (token vars only; no hex anywhere) ──

const panelClasses = "rounded-2xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] p-5 flex flex-col gap-4 overflow-hidden";
const mutedClasses = "text-[var(--pw-color-text-muted)]";

const actionButtonClasses = [
  "inline-flex min-h-[var(--pw-target-minimum)] items-center justify-center gap-2",
  "rounded-lg border border-[var(--pw-color-border-subtle)] bg-transparent",
  "px-2.5 text-[11px] text-[var(--pw-color-text-primary)]",
  "hover:border-[var(--pw-color-accent-primary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const selectClasses = [
  "min-h-[var(--pw-target-minimum)] w-[138px] rounded-lg border border-[var(--pw-color-accent-primary)]",
  "bg-[var(--pw-color-surface-panel)] px-2.5 text-[11px] text-[var(--pw-color-text-secondary)]",
  "shadow-[0_0_12px_1px_rgba(114,177,177,0.18)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const textInputClasses = [
  "min-h-[var(--pw-target-minimum)] flex-1 rounded-lg border border-[var(--pw-color-border-subtle)]",
  "bg-[var(--pw-color-surface-elevated)] px-3 text-[11px] text-[var(--pw-color-text-secondary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const screenButtonClasses = [
  "inline-flex min-h-[var(--pw-target-minimum)] items-center justify-center",
  "rounded-lg bg-[var(--pw-color-accent-primary)] px-3.5 text-[12px] font-medium",
  "text-[var(--pw-color-surface-canvas)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const waveDivider = (
  <div className="settings-divider" aria-hidden="true">
    <svg width="100%" height="8" viewBox="0 0 534 8" preserveAspectRatio="none" className="block">
      <path
        d="M0 4C44.5 1.7 133.5 6.3 267 4C400.5 1.7 489.5 6.3 534 4"
        stroke="var(--pw-color-border-subtle)"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
    </svg>
  </div>
);

/** The preference keys this screen renders, in panel order. */
const PREF_PANEL_ORDER = [
  "motion",
  "contrast",
  "density",
  "text_scale",
  "target_size",
  "accent",
] as const;

/** Human labels for pref keys (labels are presentation; values are the server's). */
const PREF_LABELS: Record<string, string> = {
  motion: "Motion",
  contrast: "Contrast",
  density: "Density",
  text_scale: "Text scale",
  target_size: "Target size",
  accent: "Accent",
};

/** Icons for pref keys, matching the Figma design. */
const PREF_ICONS: Partial<Record<string, IconName>> = {
  motion: "icon-system-device-accessibility",
};

function formatPrefOption(value: string | number, entry: PrefSchemaEntry): string {
  if (entry.unit && typeof value === "number") {
    return `${value} ${entry.unit}`;
  }
  return String(value);
}

function isCanonicalStatus(value: unknown): value is CanonicalStatus {
  return typeof value === "string" && [
    "healthy",
    "warning",
    "unknown",
    "needs_attention",
    "unavailable",
    "stale",
    "disabled",
    "not_configured",
  ].includes(value);
}

// ── Screen ──

function SettingsScreen() {
  const { withStepUp, prompt: stepUpPrompt } = useStepUp();
  const { announce } = useAnnounce();
  const { companion, setCompanion } = useCompanion();
  const { setPref } = usePrefs();
  const principal = usePrincipal();
  const apps = useApps();
  const themes = useThemes();
  const brainTemplates = useBrainTemplates();
  // Emits the shared "sections" refresh signal: SectionNav (mounted in
  // AppShell, outside this screen) subscribes to the same signal via
  // useSections(), so a sections write here updates the live nav in
  // this interaction — no reload needed.
  const emitSectionsWrite = useSectionsWrite();

  // ── Data (plain hooks on the typed client; each panel owns its state
  // so one failing panel degrades alone and names what still works —
  // A11y §4.5) ──
  const [schema, setSchema] = useState<PrefsSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [currentPrefs, setCurrentPrefs] = useState<Record<string, string | number> | null>(null);

  const [sections, setSections] = useState<SectionData[] | null>(null);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [sectionsBusy, setSectionsBusy] = useState(false);

  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [reminderText, setReminderText] = useState("");

  const [statusData, setStatusData] = useState<WorldStatus | null>(null);

  // ── Confirmation dialogs (danger = destructive, A11y §4.4) ──
  const [resetConfirm, setResetConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);

  const loadSections = useCallback(async (): Promise<SectionData[] | null> => {
    try {
      const payload = await fetchSections();
      setSectionsError(null);
      setSections(payload);
      return payload;
    } catch (e) {
      setSectionsError(e instanceof Error ? e.message : "Could not load sections.");
      return null;
    }
  }, []);

  const loadReminders = useCallback(async (): Promise<Reminder[] | null> => {
    try {
      const list = await fetchReminders();
      setRemindersError(null);
      setReminders(list);
      return list;
    } catch (e) {
      setRemindersError(e instanceof Error ? e.message : "Could not load reminders.");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Prefs + schema: schema drives the controls, /api/prefs drives the
    // current values (truth); prefs-context mirrors the display tier.
    fetchPrefsSchema()
      .then((s) => {
        if (!cancelled) setSchema(s);
      })
      .catch((e) => {
        if (!cancelled) setSchemaError(e instanceof Error ? e.message : "Could not load preference options.");
      });
    fetchPrefs()
      .then((d) => {
        if (!cancelled) setCurrentPrefs(d as unknown as Record<string, string | number>);
      })
      .catch(() => {
        /* defaults render until prefs load; the write path still validates */
      });
    void loadSections();
    void loadReminders();
    fetchWorldStatus()
      .then((d) => {
        if (!cancelled) setStatusData(d);
      })
      .catch(() => {
        /* capability panel renders its own honest failure */
      });
    return () => {
      cancelled = true;
    };
  }, [loadSections, loadReminders]);

  const companionChoicesList = useMemo(
    () => companionChoices(schema?.companion?.allowed as string[] | undefined ?? null),
    [schema]
  );

  // ── Preference write: PUT /api/prefs through step-up. The server's
  // 400 detail names the field and the reason; render it VERBATIM next
  // to the control (honest, specific — never a generic failure).
  // After ANY outcome the screen re-reads GET /api/prefs: the server
  // is the truth for what is stored, so a failed write shows the
  // server's actual values again and a successful one shows exactly
  // what the server normalized. Optimistic context updates are
  // reverted by that same re-read (companion context below). ──
  const [prefErrors, setPrefErrors] = useState<Record<string, string>>({});
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const refreshPrefs = useCallback(async () => {
    try {
      const fresh = await fetchPrefs();
      setCurrentPrefs(fresh as unknown as Record<string, string | number>);
    } catch {
      // Unreachable server: keep rendering what we had; the next
      // successful load corrects it. Errors surface on the next write.
    }
  }, []);

  const savePref = useCallback(
    async (key: string, value: string | number) => {
      // Companion choice is context machinery (prefs-context): "off"
      // never reaches the server; real vocabulary values update the
      // context and the server pref together.
      const companionBefore = companion;
      if (key === "companion") {
        if (value === COMPANION_OFF) {
          setCompanion(COMPANION_OFF);
          announce(
            "Companion artwork hidden. The World assistant is still available.",
            { kind: "action_completed", key: "companion" }
          );
          return;
        }
        setCompanion(String(value));
      } else {
        setPref(key, value);
      }
      setSavingPref(key);
      setPrefErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        await withStepUp(() => savePrefsPartial({ [key]: value }));
        announce("Settings saved.", { kind: "action_completed", key: `pref-${key}` });
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          // Server validation: show the SPECIFIC reason for THIS key.
          setPrefErrors((prev) => ({ ...prev, [key]: e.detail ?? e.message }));
        } else if (e instanceof ApiError && e.code === "step_up_required") {
          setPrefErrors((prev) => ({
            ...prev,
            [key]: "Not saved. The extra confirmation was cancelled, so nothing changed.",
          }));
        } else {
          setPrefErrors((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : "Could not save this preference." }));
        }
        // The optimistic context update lied — undo it so the UI shows
        // the server's actual stored value, not the attempt.
        if (key === "companion") {
          setCompanion(companionBefore);
        } else {
          await refreshPrefs();
        }
      } finally {
        setSavingPref(null);
        // Server truth after every attempt: success shows what the
        // server normalized; failure shows what actually persisted.
        void refreshPrefs();
      }
    },
    [announce, companion, refreshPrefs, setCompanion, setPref, withStepUp]
  );

  // ── Sections write: PUT /api/sections through step-up, then re-read
  // the server payload (order persists via the server, not local state). ──
  const putSections = useCallback(
    async (update: { order?: string[]; hidden?: string[] }, describe: string) => {
      setSectionsBusy(true);
      try {
        await withStepUp(() => saveSections(update));
        const fresh = await loadSections();
        // After a successful write: refresh the nav too. The emit makes
        // SectionNav's useSections() refetch, so hide/show/reorder and
        // "Restore default sections" land in the SAME open tab's rail
        // (visible state, not remembered state).
        await emitSectionsWrite();
        if (fresh) {
          announce(describe, { kind: "action_completed", key: "sections" });
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          setSectionsError(e.detail ?? e.message);
        } else {
          setSectionsError(e instanceof Error ? e.message : "Could not update sections.");
        }
        announce("Sections update failed.", { kind: "error", key: "sections" });
      } finally {
        setSectionsBusy(false);
      }
    },
    [announce, emitSectionsWrite, loadSections, withStepUp]
  );

  const moveSection = useCallback(
    (id: string, direction: -1 | 1) => {
      const list = sections;
      if (!list) return;
      const index = list.findIndex((s) => s.id === id);
      const swap = index + direction;
      if (index < 0 || swap < 0 || swap >= list.length) return;
      const order = list.map((s) => s.id);
      const moved = order[index];
      order[index] = order[swap];
      order[swap] = moved;
      void putSections({ order }, describeMove(list, id, direction));
    },
    [sections, putSections]
  );

  const setSectionHidden = useCallback(
    (id: string, hidden: boolean) => {
      const list = sections;
      if (!list) return;
      const currentHidden = list.filter((s) => !s.visible && !s.pinned).map((s) => s.id);
      const nextHidden = hidden
        ? [...currentHidden, id]
        : currentHidden.filter((h) => h !== id);
      const target = list.find((s) => s.id === id);
      void putSections(
        { hidden: nextHidden },
        hidden ? `${target?.label ?? id} hidden from navigation.` : `${target?.label ?? id} shown in navigation.`
      );
    },
    [sections, putSections]
  );

  const restoreDefaultSections = useCallback(() => {
    setResetConfirm(false);
    void putSections(
      { order: [], hidden: [] },
      "Sections restored to defaults."
    );
  }, [putSections]);

  // ── Reminder writes: step-up + live announcements ──
  const addReminderNow = useCallback(async () => {
    const text = reminderText.trim();
    if (!text) return;
    try {
      await withStepUp(() => addReminder(text));
      setReminderText("");
      await loadReminders();
      announce(`Reminder added: ${text}`, { kind: "action_completed", key: "reminder-add" });
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail ?? e.message : "Could not add the reminder.";
      setRemindersError(detail);
      announce(`Reminder failed: ${detail}`, { kind: "error", key: "reminder-add" });
    }
  }, [announce, loadReminders, reminderText, withStepUp]);

  const toggleReminderNow = useCallback(
    async (r: Reminder) => {
      try {
        await withStepUp(() => toggleReminder(r.id, !r.enabled));
        await loadReminders();
        announce(
          `Reminder "${r.text}" ${!r.enabled ? "enabled" : "paused"}.`,
          { kind: "action_completed", key: `reminder-${r.id}` }
        );
      } catch (e) {
        setRemindersError(e instanceof ApiError ? e.detail ?? e.message : "Could not update the reminder.");
      }
    },
    [announce, loadReminders, withStepUp]
  );

  const deleteReminderNow = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await withStepUp(() => deleteReminder(target.id));
      await loadReminders();
      announce(`Reminder deleted: ${target.text}`, { kind: "action_completed", key: `reminder-${target.id}` });
    } catch (e) {
      setRemindersError(e instanceof ApiError ? e.detail ?? e.message : "Could not delete the reminder.");
    }
  }, [announce, deleteTarget, loadReminders, withStepUp]);

  const capabilities = useMemo(() => {
    const caps = statusData?.capabilities ?? {};
    return Object.entries(caps).sort(([a], [b]) => a.localeCompare(b));
  }, [statusData]);

  const prefPanels = PREF_PANEL_ORDER.filter((key) => schema ? schema[key] !== undefined : false);
  const hasSections = sections !== null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page heading ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Icon name="icon-system-device-theme" size={24} className="text-[var(--pw-color-text-primary)]" />
          <h1 className="text-[36px] leading-tight" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
            Settings{principal.data ? ` for ${principal.data.display_name}` : ""}
          </h1>
        </div>
        <p className={`text-sm ${mutedClasses}`}>
          How your world behaves. Everything here is yours to adjust.
        </p>
      </div>

      {/* ── Settings columns ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* ═══════════ CONNECTIONS & PROVIDERS (full width) ═══════════ */}
        <div className="lg:col-span-2">
          <ConnectionsPanel />
        </div>

        {/* ═══════════ LEFT COLUMN: Reading + Companion + Reminders ═══════════ */}

        {/* ── Preferences (from GET /api/prefs/schema) ── */}
        <section aria-labelledby="prefs-heading" data-testid="prefs-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="prefs-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              How you read
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              These apply everywhere in your world.
            </p>
          </div>
          {schemaError !== null && (
            <p role="alert" className="text-sm text-[var(--pw-color-text-primary)]">
              Preference options are unavailable: {schemaError} Your current settings still apply.
            </p>
          )}
          <div className="rounded-xl bg-[var(--pw-color-surface-elevated)] overflow-hidden divide-y divide-[var(--pw-color-border-subtle)]">
            {schema === null && schemaError === null && (
              <p className="px-3.5 py-3 text-xs text-[var(--pw-color-text-muted)]">Loading preference options…</p>
            )}
            {prefPanels.map((key) => {
              const entry = schema?.[key];
              if (!entry) return null;
              const options = entry.allowed ?? [];
              const value = (currentPrefs?.[key] ?? entry.default) as string | number;
              const error = prefErrors[key];
              const prefIcon = PREF_ICONS[key];
              return (
                <div key={key} className="flex h-[42px] items-center justify-between px-3.5">
                  <label htmlFor={`pref-${key}`} className="flex items-center gap-2 text-xs text-[var(--pw-color-text-primary)]">
                    {prefIcon && <Icon name={prefIcon} size={16} className="shrink-0 text-[var(--pw-color-text-secondary)]" />}
                    {PREF_LABELS[key] ?? key}
                  </label>
                  <span className="flex flex-col items-end gap-1">
                    <select
                      id={`pref-${key}`}
                      className={selectClasses}
                      value={String(value)}
                      disabled={savingPref === key}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = entry.type === "number" ? Number(raw) : raw;
                        void savePref(key, parsed);
                      }}
                    >
                      {options.map((opt) => (
                        <option key={String(opt)} value={String(opt)}>
                          {formatPrefOption(opt, entry)}
                        </option>
                      ))}
                    </select>
                    {error && (
                      <span role="alert" data-testid={`pref-error-${key}`} className="max-w-md text-right text-[10px] text-[var(--pw-color-text-primary)]">
                        {`Not saved: ${error}`}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="settings-companion-note">
            ✦ Your companion respects these preferences too.
          </p>
        </section>

        {waveDivider}

        {/* ── Companion (schema vocabulary + frontend-only off) ── */}
        <section aria-labelledby="companion-heading" data-testid="companion-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="companion-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              Who keeps watch
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              Your companion lives throughout your world. Turning them off hides their artwork — the assistant still works.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {companionChoicesList.map((choice) => {
              const isActive = companion === choice;
              const name = choice === COMPANION_OFF ? "Off (artwork hidden)" : humanCompanion(choice);
              const companionMeta = choice !== COMPANION_OFF ? COMPANIONS[choice] : null;
              return (
                <div
                  key={choice}
                  className={[
                    "flex flex-col gap-2 h-[88px] overflow-hidden rounded-xl border p-2.5",
                    isActive
                      ? "bg-[var(--pw-color-warmth-teal-tint)] border-[var(--pw-color-accent-primary)] shadow-[0_0_12px_1px_rgba(114,177,177,0.18)]"
                      : "bg-[var(--pw-color-surface-elevated)] border-[var(--pw-color-border-subtle)]",
                    choice === COMPANION_OFF ? "w-full flex-row items-center justify-between" : "w-[240px]",
                  ].join(" ")}
                >
                  {choice === COMPANION_OFF ? (
                    <>
                      <span className="text-[11px] text-[var(--pw-color-text-secondary)]">{name}</span>
                      <button
                        type="button"
                        className={actionButtonClasses}
                        aria-pressed={isActive}
                        aria-label={isActive ? `${name}, selected` : `Select ${name}`}
                        onClick={() => void savePref("companion", choice)}
                      >
                        {isActive ? "Selected" : "Select"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <div className={[
                          "flex items-center justify-center rounded-full size-9 shrink-0",
                          isActive ? "bg-[var(--pw-color-accent-secondary)]" : "bg-[var(--pw-color-surface-panel)]",
                        ].join(" ")}>
                          {companionMeta && isActive ? (
                            <img src={companionMeta.icon} alt="" className="size-5" aria-hidden="true" />
                          ) : (
                            <Icon name="icon-world-content-world" size={22} className="text-[var(--pw-color-text-secondary)]" />
                          )}
                        </div>
                        <span className="flex-1 min-w-0 text-[11px] text-[var(--pw-color-text-primary)] truncate">{name}</span>
                      </div>
                      {isActive ? (
                        <span className="text-[10px] text-[var(--pw-color-accent-primary)]">✦ keeping watch</span>
                      ) : (
                        <button
                          type="button"
                          className={actionButtonClasses}
                          aria-label={`Select ${name}`}
                          onClick={() => void savePref("companion", choice)}
                        >
                          Select
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {waveDivider}

        {/* ── Reminders ── */}
        <section aria-labelledby="reminders-heading" data-testid="reminders-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="reminders-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              Reminders
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              Things you&apos;ve asked your world to remember.
            </p>
          </div>
          {remindersError !== null && (
            <p role="alert" className="text-sm text-[var(--pw-color-text-primary)]">
              Reminders problem: {remindersError}
            </p>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addReminderNow();
            }}
          >
            <label htmlFor="reminder-text" className="sr-only">New reminder text</label>
            <input
              id="reminder-text"
              className={textInputClasses}
              value={reminderText}
              placeholder="What should we remember?"
              onChange={(e) => setReminderText(e.target.value)}
            />
            <button type="submit" className={screenButtonClasses} disabled={reminderText.trim() === ""}>
              Add reminder
            </button>
          </form>
          <ul className="flex flex-col gap-0" data-testid="reminders-list">
            {Array.isArray(reminders) && reminders.length === 0 && (
              <li className={`py-2 text-xs ${mutedClasses}`}>No reminders yet.</li>
            )}
            {Array.isArray(reminders) &&
              reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2">
                    <Icon name="icon-status-feedback-notification" size={15} className="shrink-0 text-[var(--pw-color-accent-primary)]" />
                    <span className="text-[11px] text-[var(--pw-color-text-primary)]">{r.text}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className={actionButtonClasses}
                      aria-pressed={r.enabled}
                      aria-label={r.enabled ? `Pause reminder ${r.text}` : `Resume reminder ${r.text}`}
                      onClick={() => void toggleReminderNow(r)}
                    >
                      {r.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      className={actionButtonClasses}
                      aria-label={`Delete reminder ${r.text}`}
                      data-testid={`delete-reminder-${r.id}`}
                      onClick={() => setDeleteTarget(r)}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </section>

        {/* ═══════════ RIGHT COLUMN: Sections + Capabilities ═══════════ */}

        {/* ── Sections panel (GET/PUT /api/sections) ── */}
        <section aria-labelledby="sections-heading" data-testid="sections-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="sections-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              What you see
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              Reorder, show, or hide sections. Settings is always here.
            </p>
          </div>
          {sectionsError !== null && (
            <p role="alert" data-testid="sections-error" className="text-sm text-[var(--pw-color-text-primary)]">
              Sections update failed: {sectionsError} Nothing was changed.
            </p>
          )}
          {sections === null && sectionsError === null && (
            <p className={`text-xs ${mutedClasses}`}>Loading sections…</p>
          )}
          {hasSections && (
            <ul className="flex flex-col gap-2" data-testid="sections-list">
              {sections.map((s, index) => {
                const sectionIconName = s.icon ? sectionIconToShimName(s.icon) : null;
                return (
                  <li
                    key={s.id}
                    data-testid={`section-row-${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--pw-color-surface-elevated)] min-h-[48px] px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {sectionIconName && (
                        <Icon name={sectionIconName} size={16} className="shrink-0 text-[var(--pw-color-text-secondary)]" />
                      )}
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-[var(--pw-color-text-primary)]">{s.label}</span>
                        {s.pinned && (
                          <span className="text-[9px] text-[var(--pw-color-text-secondary)]">
                            always reachable — cannot be hidden.
                          </span>
                        )}
                      </span>
                      {s.status !== null && isCanonicalStatus(s.status) ? (
                        <StatusChip status={s.status} size="sm" />
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className={actionButtonClasses}
                        disabled={index === 0 || sectionsBusy}
                        aria-label={`Move ${s.label} up`}
                        onClick={() => moveSection(s.id, -1)}
                      >
                        ↑ Move up
                      </button>
                      <button
                        type="button"
                        className={actionButtonClasses}
                        disabled={index === sections.length - 1 || sectionsBusy}
                        aria-label={`Move ${s.label} down`}
                        onClick={() => moveSection(s.id, 1)}
                      >
                        ↓ Move down
                      </button>
                      {s.visible ? (
                        s.pinned ? null : (
                          <button
                            type="button"
                            className={actionButtonClasses}
                            disabled={sectionsBusy}
                            aria-label={`Hide ${s.label}`}
                            data-testid={`hide-${s.id}`}
                            onClick={() => setSectionHidden(s.id, true)}
                          >
                            Hide
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className={actionButtonClasses}
                          disabled={sectionsBusy}
                          aria-label={`Show ${s.label}`}
                          data-testid={`show-${s.id}`}
                          onClick={() => setSectionHidden(s.id, false)}
                        >
                          Show
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div>
            <button
              type="button"
              className={actionButtonClasses}
              data-testid="restore-sections"
              disabled={sectionsBusy}
              onClick={() => setResetConfirm(true)}
            >
              Restore default sections
            </button>
          </div>
        </section>

        {waveDivider}

        {/* ── Capability table (GET /api/status) ── */}
        <section aria-labelledby="capabilities-heading" data-testid="capabilities-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="capabilities-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              What your world can see
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              A clear view of what is available to your world.
            </p>
          </div>
          {statusData === null ? (
            <p className={`text-sm ${mutedClasses}`}>
              Capability status is unavailable right now. Everything else on this screen still works.
            </p>
          ) : (
            <Disclosure summary="Capability details" level={2} defaultOpen>
              <table className="w-full text-left">
                <caption className="sr-only">Capability status and warnings</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">Status</th>
                    <th scope="col">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--pw-color-border-subtle)]">
                  {capabilities.map(([name, cap]) => (
                    <tr key={name} className="h-[45px]">
                      <th scope="row" className="pr-4 font-normal">
                        <span className="flex items-center gap-2.5">
                          <Icon name={capabilityIcon(name)} size={16} className="shrink-0 text-[var(--pw-color-text-secondary)]" />
                          <span className="text-xs text-[var(--pw-color-text-primary)]">{humanizeName(name)}</span>
                        </span>
                      </th>
                      <td className="pr-4">
                        <StatusChip status={isCanonicalStatus(cap.status) ? cap.status : "unknown"} />
                      </td>
                      <td className="text-[var(--pw-color-text-secondary)] text-xs">
                        {cap.warnings && cap.warnings.length > 0 ? cap.warnings.join("; ") : "—"}
                      </td>
                    </tr>
                  ))}
                  {capabilities.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-2 text-xs text-[var(--pw-color-text-muted)]">
                        No capabilities are defined.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Disclosure>
          )}
          <p className="settings-companion-note">
            ✦ Your world watches these for you.
          </p>
        </section>

        {/* ── Applications ── */}
        <section aria-labelledby="apps-heading" data-testid="apps-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="apps-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              Applications
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              Services connected to your world.
            </p>
          </div>
          {apps.isLoading ? (
            <p className={`text-xs ${mutedClasses}`}>Loading applications…</p>
          ) : apps.isError ? (
            <p role="alert" className="text-sm text-[var(--pw-color-text-primary)]">
              Could not load applications.
            </p>
          ) : Array.isArray(apps.data) && apps.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {apps.data.map((app) => (
                <li key={app.id} className="flex items-center justify-between rounded-lg bg-[var(--pw-color-surface-elevated)] min-h-[44px] px-3.5 py-2">
                  <span className="text-xs text-[var(--pw-color-text-primary)]">{app.name}</span>
                  {app.url && (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={actionButtonClasses}
                    >
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-xs ${mutedClasses}`}>No applications configured.</p>
          )}
        </section>

        {waveDivider}

        {/* ── Themes ── */}
        <section aria-labelledby="themes-heading" data-testid="themes-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="themes-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              Themes
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              Appearance packs for your companion.
            </p>
          </div>
          {themes.isLoading ? (
            <p className={`text-xs ${mutedClasses}`}>Loading themes…</p>
          ) : themes.isError ? (
            <p role="alert" className="text-sm text-[var(--pw-color-text-primary)]">
              Could not load themes.
            </p>
          ) : Array.isArray(themes.data) && themes.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {themes.data.map((theme: any, i: number) => (
                <li key={theme.name || i} className="flex items-center rounded-lg bg-[var(--pw-color-surface-elevated)] min-h-[44px] px-3.5 py-2">
                  <span className="text-xs text-[var(--pw-color-text-primary)]">{theme.display_name || theme.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-xs ${mutedClasses}`}>No themes available yet. Coming soon.</p>
          )}
        </section>

        {waveDivider}

        {/* ── Brain ── */}
        <section aria-labelledby="brain-heading" data-testid="brain-panel" className={panelClasses}>
          <div className="flex flex-col gap-1.5">
            <h2 id="brain-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              Brain
            </h2>
            <p className={`text-xs leading-relaxed ${mutedClasses}`}>
              How your world thinks. Provider, model, and behavior templates.
            </p>
          </div>

          {/* Reasoning provider info */}
          <BrainProviderInfo />

          {/* Template packs */}
          {brainTemplates.isLoading ? (
            <p className={`text-xs ${mutedClasses}`}>Loading templates…</p>
          ) : brainTemplates.isError ? (
            <p role="alert" className="text-sm text-[var(--pw-color-text-primary)]">
              Could not load brain templates.
            </p>
          ) : brainTemplates.data?.templates ? (
            <Disclosure summary="Template details" level={2} defaultOpen={false}>
              <table className="w-full text-left">
                <caption className="sr-only">Brain template status</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Template</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Version</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--pw-color-border-subtle)]">
                  {brainTemplates.data.templates.map((t: BrainTemplate) => (
                    <tr key={t.id} className="h-[36px]">
                      <th scope="row" className="pr-4 font-normal">
                        <span className="text-xs text-[var(--pw-color-text-primary)]">{t.id}</span>
                      </th>
                      <td className="pr-4">
                        <span className="text-xs text-[var(--pw-color-text-secondary)]">{t.kind}</span>
                      </td>
                      <td className="pr-4">
                        <span className="text-xs text-[var(--pw-color-text-secondary)]">v{t.version}</span>
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--pw-color-text-secondary)]">{t.source}</span>
                          {t.has_override && (
                            <span className="rounded bg-[var(--pw-color-accent-primary)] px-1.5 py-0.5 text-[9px] text-[var(--pw-color-surface-canvas)]">
                              override
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Disclosure>
          ) : (
            <p className={`text-xs ${mutedClasses}`}>No templates loaded.</p>
          )}
          <p className="settings-companion-note">
            ✦ Templates are Git-native artifacts with version history.
          </p>
        </section>

        {waveDivider}

        {/* ── Profile / Identity ── */}
        <ProfilePanel principal={principal} announce={announce} withStepUp={withStepUp} />
      </div>

      {/* ── Theme packs (GET /api/themes) are artwork packages for the
          selected companion, NOT a second companion selector — the one
          canonical selection control is the Companion panel above (the
          server's companion vocabulary owns what is selectable; a pack
          name that is not in that vocabulary was previously rendered
          here as a permanently-dead "Not a companion option" row).
          Pack artwork application is deferred until a pack exists that
          the server vocabulary can actually address. ── */}

      {/* ── Dialogs ── */}
      <Dialog
        open={resetConfirm}
        title="Restore default sections?"
        description="This sends the server's reset command: your section order and hidden sections return to the defaults. The defaults always keep Settings reachable."
        confirmLabel="Restore defaults"
        danger
        onCancel={() => setResetConfirm(false)}
        onConfirm={restoreDefaultSections}
      />
      <Dialog
        open={deleteTarget !== null}
        title={deleteTarget ? `Delete reminder "${deleteTarget.text}"?` : "Delete reminder?"}
        description="This removes the reminder from your reminder list. It cannot be undone from this screen."
        confirmLabel="Delete reminder"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteReminderNow()}
      />
      {stepUpPrompt}
    </div>
  );
}

function describeMove(list: SectionData[], id: string, direction: -1 | 1): string {
  const label = list.find((s) => s.id === id)?.label ?? id;
  const at = list.findIndex((s) => s.id === id);
  if (direction === -1 && at === 1) return `${label} moved to the top.`;
  if (direction === 1 && at === list.length - 2) return `${label} moved to the bottom.`;
  return `${label} moved ${direction === -1 ? "up" : "down"}.`;
}

/** Legacy companion display names (parity with the old Settings list). */
function humanCompanion(id: string): string {
  const known = COMPANIONS[id];
  if (known) return known.name;
  switch (id) {
    case "world-tree-squirrel":
      return "World-tree Squirrel";
    case "taco-news-truck":
      return "Tacos & the Morning Paper";
    default:
      return id;
  }
}

function humanizeName(name: string): string {
  return name.replace(/_/g, " ");
}

/** Map capability names to icon sprite names. */
function capabilityIcon(name: string): IconName {
  switch (name) {
    case "journal":
      return "icon-world-content-story";
    case "media":
      return "icon-world-content-story";
    case "discovery":
      return "icon-world-content-world";
    case "reminders":
      return "icon-status-feedback-notification";
    default:
      return "icon-world-content-world";
  }
}

function BrainProviderInfo() {
  const chatProviders = useChatProviders();
  if (chatProviders.isLoading) {
    return <p className={`text-xs ${mutedClasses}`}>Loading reasoning provider…</p>;
  }
  if (chatProviders.isError || !chatProviders.data) {
    return <p className={`text-xs ${mutedClasses}`}>Reasoning provider unavailable.</p>;
  }
  const { providers, active } = chatProviders.data;
  if (!providers || providers.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--pw-color-text-primary)]">Reasoning</span>
        <p className={`text-xs ${mutedClasses}`}>
          No reasoning provider configured. The assistant will work without AI.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-[var(--pw-color-text-primary)]">Reasoning</span>
      <div className="flex flex-col gap-1">
        {providers.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between rounded-lg bg-[var(--pw-color-surface-elevated)] px-3 py-2 min-h-[40px]"
          >
            <span className="flex items-center gap-2">
              <span className={[
                "size-2 rounded-full",
                p.ok ? "bg-[var(--pw-color-accent-primary)]" : "bg-[var(--pw-color-text-secondary)]",
              ].join(" ")} />
              <span className="text-xs text-[var(--pw-color-text-primary)]">
                {p.display_name || p.name}
              </span>
              {p.name === active && (
                <span className="rounded bg-[var(--pw-color-accent-primary)] px-1.5 py-0.5 text-[9px] text-[var(--pw-color-surface-canvas)]">
                  active
                </span>
              )}
            </span>
            <StatusChip status={p.ok ? "healthy" : "unavailable"} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePanel({
  principal,
  announce,
  withStepUp,
}: {
  principal: ReturnType<typeof usePrincipal>;
  announce: (message: string, options: { kind: "action_completed" | "error"; key: string }) => void;
  withStepUp: <T>(fn: () => Promise<T>) => Promise<T>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (principal.data?.display_name) {
      setDisplayName(principal.data.display_name);
    }
  }, [principal.data?.display_name]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await withStepUp(() => savePrincipalDisplayName(trimmed));
      setSuccess(true);
      announce("Display name updated.", { kind: "action_completed", key: "profile-name" });
      window.dispatchEvent(new Event("principal-updated"));
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Could not update display name.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="profile-heading" data-testid="profile-panel" className={panelClasses}>
      <div className="flex flex-col gap-1.5">
        <h2 id="profile-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
          Profile
        </h2>
        <p className={`text-xs leading-relaxed ${mutedClasses}`}>
          How your world knows you.
        </p>
      </div>
      {principal.isLoading ? (
        <p className={`text-xs ${mutedClasses}`}>Loading profile…</p>
      ) : principal.isError ? (
        <p role="alert" className="text-sm text-[var(--pw-color-text-primary)]">
          Could not load profile.
        </p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={handleSave}>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--pw-color-text-primary)]">Display name</span>
            <input
              className={textInputClasses}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-[var(--pw-color-text-primary)]">{error}</p>
          )}
          {success && (
            <p role="status" className="text-xs text-[var(--pw-color-accent-primary)]">Saved.</p>
          )}
          <button
            type="submit"
            className={screenButtonClasses}
            disabled={saving || !displayName.trim()}
          >
            {saving ? "Saving…" : "Save name"}
          </button>
        </form>
      )}
    </section>
  );
}

export default SettingsScreen;