/**
 * Settings — Environment configuration screen for Project Worlds.
 *
 * Sections:
 *   Profile (display name from GET /api/identity/principal)
 *   Preferences (server vocabulary from GET /api/prefs: motion,
 *                contrast, density, text_scale)
 *   Sections management (reorder/hide — PUT /api/sections takes
 *                {order: ids, hidden: ids}, the server's layout delta)
 *   Capabilities status (read-only from useStatus)
 *   Brain/templates info
 *   Theme selection (presentation-only, lives on this device)
 *
 * All writes require step-up auth (HTTP 403 → honest inline notice).
 */

import { useCallback, useEffect, useState } from "react";
import {
  useStatus,
  useSession,
  usePrincipal,
  usePrefs,
  useBrainTemplates,
  useManifest,
  useSections,
  usePutPrefs,
  usePutSections,
  usePutPrincipal,
} from "../../data/hooks";
import type { components } from "../../generated/api-types";
import { describeError } from "../../data/errors";
import { STATUS_LABELS, toCapabilityStatus } from "../../data/types";
import { WorldButton } from "../../components/WorldButton";
import { THEMES, type ThemeName } from "../../generated/tokens";

type PrincipalInfo = components["schemas"]["PrincipalInfo"];
type ServerPrefs = components["schemas"]["PrefsData"];

// ─── Themes ──────────────────────────────────────────────

type Theme = ThemeName;

const THEME_LABELS: Record<Theme, string> = {
  moss: "Moss",
  ocean: "Ocean",
  starfield: "Starfield",
  station: "Station",
};

const THEME_NAMES = Object.keys(THEMES) as Theme[];

/** Read the theme actually applied to <html> so the picker tells the truth. */
function readInitialTheme(): Theme {
  const active = document.documentElement.dataset.theme;
  return THEME_NAMES.includes(active as Theme) ? (active as Theme) : "station";
}

// ─── Inline save feedback ────────────────────────────────

function SaveNote({ message, tone }: { message: string; tone: "ok" | "error" }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={[
        "mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)]",
        tone === "error"
          ? "text-[var(--pw-accent-coral)]"
          : "text-[var(--pw-text-secondary)]",
      ].join(" ")}
    >
      {message}
    </p>
  );
}

// ─── Section ordering model ──────────────────────────────

interface SectionItem {
  id: string;
  label: string;
  visible: boolean;
}

// ─── Step-up note component ──────────────────────────────

function StepUpNote() {
  return (
    <p
      className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] italic"
      role="note"
    >
      This action requires step-up authentication
    </p>
  );
}

// ─── Settings section wrapper ────────────────────────────

function SettingsSection({
  id,
  titleId,
  children,
}: {
  id: string;
  titleId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className="mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h2
        id={titleId}
        className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]"
      >
        {id}
      </h2>
      {children}
    </section>
  );
}

// ─── Profile section ─────────────────────────────────────

function ProfileSection({
  authenticated,
  isSessionLoading,
  principal,
  isPrincipalLoading,
}: {
  authenticated: boolean;
  isSessionLoading: boolean;
  principal: PrincipalInfo | undefined;
  isPrincipalLoading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saveMessage, setSaveMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const putPrincipal = usePutPrincipal();

  const beginEdit = useCallback(() => {
    setDisplayName(principal?.display_name ?? "");
    setSaveMessage(null);
    setEditing(true);
  }, [principal?.display_name]);

  const handleSave = useCallback(() => {
    setSaveMessage(null);
    putPrincipal.mutate(displayName.trim(), {
      onSuccess: () => {
        setEditing(false);
        setSaveMessage({ text: "Display name saved.", tone: "ok" });
      },
      onError: (err) => {
        // 403 = step-up gate; anything else shows the server's reason.
        setSaveMessage({
          text: describeError(err, "Could not save the display name."),
          tone: "error",
        });
      },
    });
  }, [displayName, putPrincipal]);

  const handleCancel = useCallback(() => {
    setDisplayName(principal?.display_name ?? "");
    setEditing(false);
    setSaveMessage(null);
  }, [principal?.display_name]);

  if (isSessionLoading || (authenticated && isPrincipalLoading)) {
    return (
      <SettingsSection id="Profile" titleId="settings-profile-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Loading…
        </p>
      </SettingsSection>
    );
  }

  if (!authenticated) {
    return (
      <SettingsSection id="Profile" titleId="settings-profile-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Not authenticated
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="Profile" titleId="settings-profile-heading">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-[var(--pw-spacing-md)]"
        >
          <div>
            <label
              htmlFor="settings-display-name"
              className="block mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
            >
              Display name
            </label>
            <input
              id="settings-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
              aria-label="Display name"
            />
          </div>
          <div className="flex gap-[var(--pw-spacing-md)]">
            <WorldButton
              variant="primary"
              type="submit"
              isDisabled={putPrincipal.isPending || !displayName.trim()}
            >
              {putPrincipal.isPending ? "Saving…" : "Save"}
            </WorldButton>
            <WorldButton
              variant="ghost"
              type="button"
              onPress={handleCancel}
              isDisabled={putPrincipal.isPending}
            >
              Cancel
            </WorldButton>
          </div>
          {saveMessage && <SaveNote message={saveMessage.text} tone={saveMessage.tone} />}
          <StepUpNote />
        </form>
      ) : (
        <div className="flex items-center justify-between gap-[var(--pw-spacing-md)]">
          <div>
            <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
              {principal?.display_name ?? "Unnamed"}
            </p>
            <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              Display name
            </p>
          </div>
          <WorldButton
            variant="ghost"
            onPress={beginEdit}
            aria-label="Edit display name"
          >
            Edit
          </WorldButton>
        </div>
      )}
    </SettingsSection>
  );
}

// ─── Preferences section ─────────────────────────────────

/** The multipliers the server accepts (prefs.py TEXT_SCALE.allowed). */
const TEXT_SCALES = [1, 1.25, 1.5] as const;

function PreferencesSection({
  prefs,
  onChange,
  onSaved,
}: {
  prefs: ServerPrefs;
  onChange: (prefs: ServerPrefs) => void;
  onSaved: () => void;
}) {
  const [saveMessage, setSaveMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const putPrefs = usePutPrefs();

  const handleSave = useCallback(() => {
    setSaveMessage(null);
    putPrefs.mutate(prefs, {
      onSuccess: () => {
        onSaved();
        setSaveMessage({ text: "Preferences saved.", tone: "ok" });
      },
      onError: (err) =>
        setSaveMessage({
          text: describeError(err, "Could not save preferences."),
          tone: "error",
        }),
    });
  }, [prefs, putPrefs, onSaved]);

  return (
    <SettingsSection id="Preferences" titleId="settings-prefs-heading">
      <div className="space-y-[var(--pw-spacing-lg)]">
        {/* Motion — the server's accessibility floor vocabulary
            (src/personal_world/prefs.py): off / reduced / subtle. */}
        <div>
          <label
            htmlFor="pref-motion"
            className="block mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
          >
            Motion
          </label>
          <select
            id="pref-motion"
            value={prefs.motion}
            onChange={(e) =>
              onChange({ ...prefs, motion: e.target.value as ServerPrefs["motion"] })
            }
            className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          >
            <option value="off">No motion</option>
            <option value="reduced">Reduced motion</option>
            <option value="subtle">Subtle motion</option>
          </select>
        </div>

        {/* Contrast */}
        <div>
          <label
            htmlFor="pref-contrast"
            className="block mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
          >
            Contrast
          </label>
          <select
            id="pref-contrast"
            value={prefs.contrast}
            onChange={(e) =>
              onChange({ ...prefs, contrast: e.target.value as ServerPrefs["contrast"] })
            }
            className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          >
            <option value="comfortable">Comfortable</option>
            <option value="high">High contrast</option>
          </select>
        </div>

        {/* Density */}
        <div>
          <label
            htmlFor="pref-density"
            className="block mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
          >
            Density
          </label>
          <select
            id="pref-density"
            value={prefs.density}
            onChange={(e) =>
              onChange({ ...prefs, density: e.target.value as ServerPrefs["density"] })
            }
            className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>

        {/* Text scale — numeric multipliers the server accepts (1 / 1.25 / 1.5) */}
        <div>
          <label
            htmlFor="pref-text-scale"
            className="block mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
          >
            Text size
          </label>
          <select
            id="pref-text-scale"
            value={String(prefs.text_scale)}
            onChange={(e) => {
              const value = Number(e.target.value);
              const scale = TEXT_SCALES.find((s) => s === value);
              // An unlisted multiplier is not applied — the select can
              // only offer server-legal values anyway.
              if (scale) onChange({ ...prefs, text_scale: scale });
            }}
            className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          >
            <option value="1">Default</option>
            <option value="1.25">Large</option>
            <option value="1.5">Largest</option>
          </select>
        </div>

        <WorldButton variant="primary" onPress={handleSave} isDisabled={putPrefs.isPending}>
          {putPrefs.isPending ? "Saving…" : "Save preferences"}
        </WorldButton>
        {saveMessage && <SaveNote message={saveMessage.text} tone={saveMessage.tone} />}
        <StepUpNote />
      </div>
    </SettingsSection>
  );
}

// ─── Sections management ───────────────────────────────

function SectionsManager({
  serverSections,
  onReorder,
  onToggle,
  onSaved,
}: {
  serverSections: SectionItem[];
  onReorder: (sections: SectionItem[]) => void;
  onToggle: (id: string) => void;
  onSaved: () => void;
}) {
  const [saveMessage, setSaveMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const putSections = usePutSections();

  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const next = [...serverSections];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onReorder(next);
    },
    [serverSections, onReorder]
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index === serverSections.length - 1) return;
      const next = [...serverSections];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onReorder(next);
    },
    [serverSections, onReorder]
  );

  const handleSave = useCallback(() => {
    setSaveMessage(null);
    // Contract shape (sections.validate_layout_update): {order: ids,
    // hidden: ids}. Hidden = everything currently toggled off.
    putSections.mutate(
      {
        order: serverSections.map((s) => s.id),
        hidden: serverSections.filter((s) => !s.visible).map((s) => s.id),
      },
      {
        onSuccess: () => {
          onSaved();
          setSaveMessage({ text: "Section order saved.", tone: "ok" });
        },
        onError: (err) =>
          setSaveMessage({
            text: describeError(err, "Could not save section order."),
            tone: "error",
          }),
      }
    );
  }, [serverSections, putSections, onSaved]);

  if (serverSections.length === 0) {
    return (
      <SettingsSection id="Sections" titleId="settings-sections-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          No sections available
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="Sections" titleId="settings-sections-heading">
      <ul className="space-y-[var(--pw-spacing-sm)]" role="list">
        {serverSections.map((section, index) => (
          <li
            key={section.id}
            className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]"
          >
            <div className="flex flex-col gap-1">
              <WorldButton
                variant="ghost"
                onPress={() => moveUp(index)}
                isDisabled={index === 0}
                aria-label={`Move ${section.label} up`}
                className="!min-h-[28px] !min-w-[28px] !px-1 !py-0 text-[var(--pw-typography-size_micro)]"
              >
                ▲
              </WorldButton>
              <WorldButton
                variant="ghost"
                onPress={() => moveDown(index)}
                isDisabled={index === serverSections.length - 1}
                aria-label={`Move ${section.label} down`}
                className="!min-h-[28px] !min-w-[28px] !px-1 !py-0 text-[var(--pw-typography-size_micro)]"
              >
                ▼
              </WorldButton>
            </div>
            <span className="flex-1 text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
              {section.label}
            </span>
            <label className="flex items-center gap-[var(--pw-spacing-sm)] cursor-pointer">
              <span className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                {section.visible ? "Visible" : "Hidden"}
              </span>
              <input
                type="checkbox"
                checked={section.visible}
                onChange={() => onToggle(section.id)}
                className="min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] accent-[var(--pw-accent-teal)]"
                aria-label={`Toggle ${section.label} visibility`}
              />
            </label>
          </li>
        ))}
      </ul>
      <WorldButton
        variant="primary"
        onPress={handleSave}
        isDisabled={putSections.isPending}
        className="mt-[var(--pw-spacing-md)]"
      >
        {putSections.isPending ? "Saving…" : "Save section order"}
      </WorldButton>
      {saveMessage && <SaveNote message={saveMessage.text} tone={saveMessage.tone} />}
      <StepUpNote />
    </SettingsSection>
  );
}

// ─── Capabilities status ─────────────────────────────────

function CapabilitiesSection({
  capabilities,
  isStatusLoading,
}: {
  capabilities: components["schemas"]["CapabilityMap"] | undefined;
  isStatusLoading: boolean;
}) {
  if (isStatusLoading) {
    return (
      <SettingsSection id="Capabilities" titleId="settings-capabilities-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Loading…
        </p>
      </SettingsSection>
    );
  }

  const entries = Object.entries(capabilities ?? {});

  if (entries.length === 0) {
    return (
      <SettingsSection id="Capabilities" titleId="settings-capabilities-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          No capabilities reported
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="Capabilities" titleId="settings-capabilities-heading">
      <ul className="space-y-[var(--pw-spacing-sm)]" role="list">
        {entries.map(([id, cap]) => {
          const statusLabel = STATUS_LABELS[toCapabilityStatus(cap.status)];
          const displayName = id
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <li
              key={id}
              className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                  {displayName}
                </p>
                {cap.warnings.length > 0 && (
                  <p className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] mt-1">
                    {cap.warnings[0]}
                  </p>
                )}
              </div>
              <span
                className="text-[var(--pw-typography-size_micro)] font-medium text-[var(--pw-text-secondary)] shrink-0"
                aria-label={`Status: ${statusLabel}`}
              >
                {statusLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </SettingsSection>
  );
}

// ─── Brain / Templates info ──────────────────────────────

function BrainSection({
  templates,
  isBrainLoading,
  endpointCount,
  isManifestLoading,
}: {
  templates: components["schemas"]["BrainTemplate"][];
  isBrainLoading: boolean;
  endpointCount: number;
  isManifestLoading: boolean;
}) {
  if (isBrainLoading || isManifestLoading) {
    return (
      <SettingsSection id="Brain & Templates" titleId="settings-brain-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Loading…
        </p>
      </SettingsSection>
    );
  }

  if (templates.length === 0 && endpointCount === 0) {
    return (
      <SettingsSection id="Brain & Templates" titleId="settings-brain-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          No brain templates configured
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="Brain & Templates" titleId="settings-brain-heading">
      {endpointCount > 0 && (
        <p className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          The station publishes {endpointCount} API endpoints.
        </p>
      )}

      {templates.length > 0 ? (
        <>
          <p className="mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
            Templates ({templates.length})
          </p>
          <ul className="space-y-[var(--pw-spacing-sm)]" role="list">
            {templates.map((t, i) => (
              <li
                key={t.id ?? i}
                className="p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]"
              >
                <p className="text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                  {t.id}
                </p>
                <div className="flex gap-[var(--pw-spacing-md)] mt-1 text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                  <span>Kind: {t.kind}</span>
                  {t.surface !== null && <span>Surface: {t.surface}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          No templates available
        </p>
      )}
    </SettingsSection>
  );
}

// ─── Theme selection ─────────────────────────────────────

function ThemeSection({
  currentTheme,
  onSelect,
}: {
  currentTheme: Theme;
  onSelect: (theme: Theme) => void;
}) {
  return (
    <SettingsSection id="Theme" titleId="settings-theme-heading">
      <fieldset>
        <legend className="sr-only">Select a theme</legend>
        <div className="grid grid-cols-2 gap-[var(--pw-spacing-md)]">
          {THEME_NAMES.map((theme) => {
            const isActive = theme === currentTheme;
            return (
              <label
                key={theme}
                className={[
                  "flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border min-h-[var(--pw-targets-minimum)] cursor-pointer transition-colors motion-reduce:transition-none",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--pw-accent-primary)]",
                  isActive
                    ? "border-[var(--pw-accent-primary)] bg-[var(--pw-surface-elevated)]"
                    : "border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] hover:bg-[var(--pw-surface-elevated)]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  checked={isActive}
                  onChange={() => onSelect(theme)}
                  className="sr-only"
                />
                <span className="text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                  {THEME_LABELS[theme]}
                </span>
                {isActive && (
                  <span
                    className="ml-auto text-[var(--pw-typography-size_micro)] text-[var(--pw-accent-teal)]"
                    aria-hidden="true"
                  >
                    ● selected
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
    </SettingsSection>
  );
}

// ─── Main Settings screen ────────────────────────────────

const FALLBACK_PREFS: ServerPrefs = {
  motion: "reduced",
  contrast: "comfortable",
  density: "comfortable",
  text_scale: 1,
  target_size: 44,
  companion: "personal-world",
  accent: "world-keeper",
};

export function Settings() {
  // Server state
  const { data: status, isLoading: isStatusLoading } = useStatus();
  const { data: session, isLoading: isSessionLoading } = useSession();
  const { data: principal, isLoading: isPrincipalLoading } = usePrincipal();
  const prefsQuery = usePrefs();
  const { data: brain, isLoading: isBrainLoading } = useBrainTemplates();
  const { data: manifest, isLoading: isManifestLoading } = useManifest();
  const sectionsQuery = useSections();

  // Preference draft: the server's values until the person edits; a
  // successful save clears the draft so the next render re-reads the
  // server truth (no effect-driven state sync).
  const [prefDraft, setPrefDraft] = useState<ServerPrefs | null>(null);
  const effectivePrefs = prefDraft ?? prefsQuery.data?.data ?? FALLBACK_PREFS;

  // Section ordering draft — derived from the server's resolved list,
  // overridden locally until a save lands.
  const serverRows: SectionItem[] = (sectionsQuery.data?.data?.sections ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, label: s.label, visible: s.visible }));
  const [sectionDraft, setSectionDraft] = useState<SectionItem[] | null>(null);
  const editableSections = sectionDraft ?? serverRows;

  const handleReorderSections = useCallback(
    (next: SectionItem[]) => setSectionDraft(next),
    [],
  );

  // Section toggle handler
  const handleToggleSection = useCallback(
    (id: string) => {
      setSectionDraft((prev) =>
        (prev ?? serverRows).map((s) =>
          s.id === id ? { ...s, visible: !s.visible } : s,
        ),
      );
    },
    [serverRows],
  );

  // Theme — presentation-only, lives on this device. Read from the
  // applied document attribute so the picker reflects reality, and
  // write it back on every change.
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-[var(--pw-spacing-md)] focus:left-[var(--pw-spacing-md)] focus:z-50 focus:px-[var(--pw-spacing-lg)] focus:py-[var(--pw-spacing-sm)] focus:bg-[var(--pw-surface-panel)] focus:text-[var(--pw-accent-teal)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)] focus:rounded-[var(--pw-radius-sm)]"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        aria-label="Settings"
        className="relative z-10 p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)] max-w-[720px]"
      >
        <header className="mb-[var(--pw-spacing-2xl)]">
          <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
            Settings
          </h1>
          <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Configure your environment
          </p>
        </header>

        <ProfileSection
          authenticated={session?.ok === true}
          isSessionLoading={isSessionLoading}
          principal={principal?.data}
          isPrincipalLoading={isPrincipalLoading}
        />

        {prefsQuery.isPending ? (
          <SettingsSection id="Preferences" titleId="settings-prefs-heading">
            <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              Loading…
            </p>
          </SettingsSection>
        ) : prefsQuery.isError || prefsQuery.data?.data === undefined ? (
          <SettingsSection id="Preferences" titleId="settings-prefs-heading">
            <p
              role="alert"
              className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
            >
              {prefsQuery.error instanceof Error
                ? prefsQuery.error.message
                : "Preferences are unavailable on this station."}
            </p>
          </SettingsSection>
        ) : (
          <PreferencesSection
            prefs={effectivePrefs}
            onChange={setPrefDraft}
            onSaved={() => setPrefDraft(null)}
          />
        )}

        <SectionsManager
          serverSections={editableSections}
          onReorder={handleReorderSections}
          onToggle={handleToggleSection}
          onSaved={() => setSectionDraft(null)}
        />

        <CapabilitiesSection
          capabilities={status?.data?.capabilities}
          isStatusLoading={isStatusLoading}
        />

        <BrainSection
          templates={brain?.data?.templates ?? []}
          isBrainLoading={isBrainLoading}
          endpointCount={manifest?.endpoints.length ?? 0}
          isManifestLoading={isManifestLoading}
        />

        <ThemeSection currentTheme={theme} onSelect={setTheme} />
      </main>
    </>
  );
}
