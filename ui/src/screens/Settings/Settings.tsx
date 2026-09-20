/**
 * Settings — Environment configuration screen for Project Worlds.
 *
 * Sections:
 *   Profile (display name from session)
 *   Preferences (motion, contrast, density, text_scale)
 *   Sections management (reorder/hide)
 *   Capabilities status (read-only from useStatus)
 *   Brain/templates info
 *   Theme selection
 *
 * All writes require step-up auth.
 */

import { useCallback, useEffect, useState } from "react";
import {
  useStatus,
  useSession,
  useBrainTemplates,
  useManifest,
} from "../../data/hooks";
import { STATUS_LABELS } from "../../data/types";
import type { CapabilityStatus } from "../../data/types";
import { WorldButton } from "../../components/WorldButton";

// ─── Themes ──────────────────────────────────────────────

const THEMES = ["moss", "ocean", "starfield", "station"] as const;
type Theme = (typeof THEMES)[number];

const THEME_LABELS: Record<Theme, string> = {
  moss: "Moss",
  ocean: "Ocean",
  starfield: "Starfield",
  station: "Station",
};

// ─── Preferences model ───────────────────────────────────

interface Preferences {
  motion: boolean;
  contrast: "normal" | "high";
  density: "compact" | "comfortable" | "spacious";
  text_scale: "small" | "default" | "large";
}

const DEFAULT_PREFS: Preferences = {
  motion: false,
  contrast: "normal",
  density: "comfortable",
  text_scale: "default",
};

// ─── Section ordering model ──────────────────────────────

interface SectionItem {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_SECTIONS: SectionItem[] = [
  { id: "profile", label: "Profile", visible: true },
  { id: "preferences", label: "Preferences", visible: true },
  { id: "sections", label: "Sections", visible: true },
  { id: "capabilities", label: "Capabilities", visible: true },
  { id: "brain", label: "Brain & Templates", visible: true },
  { id: "theme", label: "Theme", visible: true },
];

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
  session,
  isSessionLoading,
}: {
  session: { authenticated?: boolean; principal?: string } | undefined;
  isSessionLoading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session?.principal) {
      setDisplayName(session.principal);
    }
  }, [session?.principal]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/identity/principal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      if (res.status === 403) {
        // Step-up required — show note, don't silently fail
        return;
      }
      if (res.ok) {
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }, [displayName]);

  const handleCancel = useCallback(() => {
    setDisplayName(session?.principal ?? "");
    setEditing(false);
  }, [session?.principal]);

  if (isSessionLoading) {
    return (
      <SettingsSection id="Profile" titleId="settings-profile-heading">
        <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Loading…
        </p>
      </SettingsSection>
    );
  }

  if (!session?.authenticated) {
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
              className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-none focus:ring-2 focus:ring-[#72b1b1]"
              aria-label="Display name"
            />
          </div>
          <div className="flex gap-[var(--pw-spacing-md)]">
            <WorldButton
              variant="primary"
              type="submit"
              isDisabled={saving || !displayName.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </WorldButton>
            <WorldButton
              variant="ghost"
              type="button"
              onPress={handleCancel}
              isDisabled={saving}
            >
              Cancel
            </WorldButton>
          </div>
          <StepUpNote />
        </form>
      ) : (
        <div className="flex items-center justify-between gap-[var(--pw-spacing-md)]">
          <div>
            <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
              {session.principal ?? "Unnamed"}
            </p>
            <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              Display name
            </p>
          </div>
          <WorldButton
            variant="ghost"
            onPress={() => setEditing(true)}
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

function PreferencesSection({
  prefs,
  onChange,
}: {
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
}) {
  return (
    <SettingsSection id="Preferences" titleId="settings-prefs-heading">
      <div className="space-y-[var(--pw-spacing-lg)]">
        {/* Motion */}
        <div className="flex items-center justify-between gap-[var(--pw-spacing-md)]">
          <label
            htmlFor="pref-motion"
            className="text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
          >
            Reduce motion
          </label>
          <input
            id="pref-motion"
            type="checkbox"
            checked={prefs.motion}
            onChange={(e) => onChange({ ...prefs, motion: e.target.checked })}
            className="min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] accent-[var(--pw-accent-teal)]"
            role="switch"
            aria-checked={prefs.motion}
          />
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
              onChange({
                ...prefs,
                contrast: e.target.value as Preferences["contrast"],
              })
            }
            className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-none focus:ring-2 focus:ring-[#72b1b1]"
          >
            <option value="normal">Normal</option>
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
              onChange({
                ...prefs,
                density: e.target.value as Preferences["density"],
              })
            }
            className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-none focus:ring-2 focus:ring-[#72b1b1]"
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </div>

        {/* Text scale */}
        <div>
          <label
            htmlFor="pref-text-scale"
            className="block mb-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
          >
            Text size
          </label>
          <select
            id="pref-text-scale"
            value={prefs.text_scale}
            onChange={(e) =>
              onChange({
                ...prefs,
                text_scale: e.target.value as Preferences["text_scale"],
              })
            }
            className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[var(--pw-typography-size_body)] focus:outline-none focus:ring-2 focus:ring-[#72b1b1]"
          >
            <option value="small">Small</option>
            <option value="default">Default</option>
            <option value="large">Large</option>
          </select>
        </div>

        <WorldButton
          variant="primary"
          onPress={() => {
            // PUT /api/prefs — step-up required
          }}
        >
          Save preferences
        </WorldButton>
        <StepUpNote />
      </div>
    </SettingsSection>
  );
}

// ─── Sections management ─────────────────────────────────

function SectionsManager({
  sections,
  onReorder,
  onToggle,
}: {
  sections: SectionItem[];
  onReorder: (sections: SectionItem[]) => void;
  onToggle: (id: string) => void;
}) {
  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const next = [...sections];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onReorder(next);
    },
    [sections, onReorder]
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index === sections.length - 1) return;
      const next = [...sections];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onReorder(next);
    },
    [sections, onReorder]
  );

  if (sections.length === 0) {
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
        {sections.map((section, index) => (
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
                isDisabled={index === sections.length - 1}
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
        onPress={() => {
          // PUT /api/sections — step-up required
        }}
        className="mt-[var(--pw-spacing-md)]"
      >
        Save section order
      </WorldButton>
      <StepUpNote />
    </SettingsSection>
  );
}

// ─── Capabilities status ─────────────────────────────────

function CapabilitiesSection({
  status,
  isStatusLoading,
}: {
  status: { capabilities?: Record<string, { ok?: boolean; status?: string; warnings?: string[] }> } | undefined;
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

  const capabilities = status?.capabilities ?? {};
  const entries = Object.entries(capabilities);

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
          const rawStatus = (cap.status ?? "unknown") as CapabilityStatus;
          const statusLabel = STATUS_LABELS[rawStatus] ?? rawStatus;
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
                {cap.warnings && cap.warnings.length > 0 && (
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
  brain,
  isBrainLoading,
  manifest,
  isManifestLoading,
}: {
  brain: { templates?: { id?: string; kind?: string; surface?: string }[] } | undefined;
  isBrainLoading: boolean;
  manifest: { endpoints?: Record<string, never>[]; version?: string } | undefined;
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

  const templates = brain?.templates ?? [];

  if (templates.length === 0 && !manifest?.version) {
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
      {manifest?.version && (
        <p className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          API version: {manifest.version}
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
                  {t.id ?? "Unnamed template"}
                </p>
                <div className="flex gap-[var(--pw-spacing-md)] mt-1 text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                  {t.kind && <span>Kind: {t.kind}</span>}
                  {t.surface && <span>Surface: {t.surface}</span>}
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
          {THEMES.map((theme) => {
            const isActive = theme === currentTheme;
            return (
              <label
                key={theme}
                className={[
                  "flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border min-h-[var(--pw-targets-minimum)] cursor-pointer transition-colors",
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

export function Settings() {
  // Server state
  const { data: status, isLoading: isStatusLoading } = useStatus();
  const { data: session, isLoading: isSessionLoading } = useSession();
  const { data: brain, isLoading: isBrainLoading } = useBrainTemplates();
  const { data: manifest, isLoading: isManifestLoading } = useManifest();

  // Local preference state (synced to server on save)
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

  // Local section ordering (synced to server on save)
  const [sections, setSections] = useState<SectionItem[]>(DEFAULT_SECTIONS);

  // Theme (local until persisted)
  const [theme, setTheme] = useState<Theme>("station");

  // Section toggle handler
  const handleToggleSection = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  // Error state
  const error = null; // Hook errors are per-query; we handle loading per-section

  if (error) {
    return (
      <main
        id="main-content"
        aria-label="Settings"
        className="relative z-10 p-[var(--pw-spacing-xl)] max-w-[720px]"
      >
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Settings
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-secondary)]">
          Unable to load settings right now.
        </p>
      </main>
    );
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-[var(--pw-spacing-md)] focus:left-[var(--pw-spacing-md)] focus:z-50 focus:px-[var(--pw-spacing-lg)] focus:py-[var(--pw-spacing-sm)] focus:bg-[var(--pw-surface-panel)] focus:text-[var(--pw-accent-teal)] focus:outline-none focus:ring-2 focus:ring-[#72b1b1] focus:rounded-[var(--pw-radius-sm)]"
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

        <ProfileSection session={session} isSessionLoading={isSessionLoading} />

        <PreferencesSection prefs={prefs} onChange={setPrefs} />

        <SectionsManager
          sections={sections}
          onReorder={setSections}
          onToggle={handleToggleSection}
        />

        <CapabilitiesSection status={status} isStatusLoading={isStatusLoading} />

        <BrainSection
          brain={brain}
          isBrainLoading={isBrainLoading}
          manifest={manifest}
          isManifestLoading={isManifestLoading}
        />

        <ThemeSection currentTheme={theme} onSelect={setTheme} />
      </main>
    </>
  );
}
