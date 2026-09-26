/**
 * Settings — Environment configuration screen for Project Worlds.
 *
 * Sections:
 *   Profile (display name from GET /api/identity/principal)
 *   Customize (SettingsRoom — rendered from the server's
 *                own vocabulary via GET /api/prefs/schema; a11y
 *                contract §9.2 names this section)
 *   Personal sections management (reorder/hide — PUT /api/sections
 *                takes {order: ids, hidden: ids}, the server's layout
 *                delta. The skeleton landmarks are NOT offered here:
 *                Overview · Memory · Chat · Settings are fixed by the
 *                product contract, and a toggle that cannot move them
 *                would only lie.)
 *   Capabilities status (read-only from GET /api/status)
 *   Brain/templates info
 *   Theme selection (presentation-only, lives on this device — the
 *                station has no theme-write endpoint, and the section
 *                says so plainly)
 *   Advanced — the secrets Vault tool (VaultTool), relocated here per
 *                docs/PRODUCT-LANGUAGE.md: security infrastructure
 *                "rarely needs a direct user-facing presence", while
 *                Records — the person's own structured information —
 *                live inside Memory. All vault behaviour preserved.
 *
 * All writes require step-up auth (HTTP 403 → honest inline notice).
 *
 * Server envelopes arrive here as `unknown` bodies (the generated API
 * types describe these responses as open objects because the server
 * sends open objects). Nothing is cast to a fantasy type: every read
 * goes through ./parse.ts runtime checks, and every value the check
 * rejects degrades to an honest empty/unknown state.
 */

import { useCallback, useEffect, useState } from "react";
import {
  useBriefing,
  useStatus,
  useSession,
  usePrincipal,
  useBrainTemplates,
  useManifest,
  useSections,
  usePutSections,
  usePutPrincipal,
  useMe,
} from "../../data/hooks";
import { describeError } from "../../data/errors";
import {
  capabilityDisplayName,
  PERSONAL_AREAS,
  SKELETON_AREAS,
  STATUS_LABELS,
  toCapabilityStatus,
} from "../../data/types";
import { WorldButton } from "../../components/WorldButton";
import { CompanionFace } from "../../components/crew/CompanionFace";
import { setFirstDayHidden, useFirstDayHidden } from "../Bridge/firstDay";
import { MESSAGES_MODES, setMessagesMode, useMessagesMode } from "../Bridge/companionMessages";
import { VaultTool } from "../Vault/Vault";
import { THEMES, type ThemeName } from "../../generated/tokens";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  readStoredTheme,
  saveStoredTheme,
} from "../../app/prefs-dom";
import { SettingsRoom } from "./SettingsRoom";
import {
  countManifestEndpoints,
  principalDisplayName,
  readBrainTemplates,
  readCapabilityRows,
  readSectionRows,
} from "./parse";

// ─── Themes ──────────────────────────────────────────────

type Theme = ThemeName;

const THEME_LABELS: Record<Theme, string> = {
  doorways: "Doorways",
  moss: "Moss",
  ocean: "Ocean",
  plain: "Plain",
  starfield: "Starfield",
  station: "Station",
};

const THEME_NAMES = Object.keys(THEMES) as Theme[];

/** Read the theme this device actually chose (C12: same persistence
 *  model the old station.js chrome used — localStorage, not the
 *  server, because no theme-write endpoint exists), falling back to
 *  whatever is applied on <html>, then to the first-run default
 *  (DEFAULT_THEME, starfield — 2026-09-25). */

/** Section headings in the Doorways look: the serif, sentence case. */
const SECTION_HEADING =
  "text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]";
const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;

function readInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  const active = document.documentElement.dataset.theme;
  const names = Object.keys(THEMES) as Theme[];
  return names.includes(active as Theme) ? (active as Theme) : DEFAULT_THEME;
}

// ─── Inline save feedback ────────────────────────────────

function SaveNote({ message, tone }: { message: string; tone: "ok" | "error" }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
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
      className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)] italic"
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
        className={`mb-[var(--pw-spacing-md)] ${SECTION_HEADING}`}
        style={SERIF}
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
  displayName,
  isPrincipalLoading,
}: {
  authenticated: boolean;
  isSessionLoading: boolean;
  displayName: string | null;
  isPrincipalLoading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saveMessage, setSaveMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const putPrincipal = usePutPrincipal();

  const beginEdit = useCallback(() => {
    setDraftName(displayName ?? "");
    setSaveMessage(null);
    setEditing(true);
  }, [displayName]);

  const handleSave = useCallback(() => {
    setSaveMessage(null);
    putPrincipal.mutate(draftName.trim(), {
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
  }, [draftName, putPrincipal]);

  const handleCancel = useCallback(() => {
    setDraftName(displayName ?? "");
    setEditing(false);
    setSaveMessage(null);
  }, [displayName]);

  if (isSessionLoading || (authenticated && isPrincipalLoading)) {
    return (
      <SettingsSection id="Profile" titleId="settings-profile-heading">
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Loading…
        </p>
      </SettingsSection>
    );
  }

  if (!authenticated) {
    return (
      <SettingsSection id="Profile" titleId="settings-profile-heading">
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
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
              className="block mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]"
            >
              Display name
            </label>
            <input
              id="settings-display-name"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full min-h-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)] text-[length:var(--pw-typography-size_body)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
              aria-label="Display name"
            />
          </div>
          <div className="flex gap-[var(--pw-spacing-md)]">
            <WorldButton
              variant="primary"
              type="submit"
              isDisabled={putPrincipal.isPending || !draftName.trim()}
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
            <p className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
              {displayName ?? "Not set"}
            </p>
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
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

  const landmarkWords = SKELETON_AREAS.map((a) => a.label).join(" · ");

  if (serverSections.length === 0) {
    return (
      <SettingsSection id="Personal sections" titleId="settings-sections-heading">
        <p className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          No personal sections are advertised as reorderable.
        </p>
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          The landmarks {landmarkWords} are fixed by design and stay in
          the bar above no matter what is reordered or hidden here.
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="Personal sections" titleId="settings-sections-heading">
      <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Order or hide your personal sections here. The landmarks{" "}
        {landmarkWords} always come first and can never be moved or
        hidden — so the way home never changes.
      </p>
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
                className="!min-h-[28px] !min-w-[28px] !px-1 !py-0 text-[length:var(--pw-typography-size_micro)]"
              >
                ▲
              </WorldButton>
              <WorldButton
                variant="ghost"
                onPress={() => moveDown(index)}
                isDisabled={index === serverSections.length - 1}
                aria-label={`Move ${section.label} down`}
                className="!min-h-[28px] !min-w-[28px] !px-1 !py-0 text-[length:var(--pw-typography-size_micro)]"
              >
                ▼
              </WorldButton>
            </div>
            <span className="flex-1 text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
              {section.label}
            </span>
            <label className="flex items-center gap-[var(--pw-spacing-sm)] cursor-pointer">
              <span className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
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
  capabilities: ReturnType<typeof readCapabilityRows>;
  isStatusLoading: boolean;
}) {
  if (isStatusLoading) {
    return (
      <SettingsSection id="Capabilities" titleId="settings-capabilities-heading">
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Loading…
        </p>
      </SettingsSection>
    );
  }

  if (capabilities.length === 0) {
    return (
      <SettingsSection id="Capabilities" titleId="settings-capabilities-heading">
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          No capabilities reported
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="Capabilities" titleId="settings-capabilities-heading">
      <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Read-only: Worlds reports what it can do; you can’t switch these here.
      </p>
      <ul className="space-y-[var(--pw-spacing-sm)]" role="list">
        {capabilities.map((cap) => {
          const statusLabel = STATUS_LABELS[toCapabilityStatus(cap.status)];
          const displayName = capabilityDisplayName(cap.id);

          return (
            <li
              key={cap.id}
              className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                  {displayName}
                </p>
                {cap.firstWarning !== null && (
                  <p className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)] mt-1">
                    {cap.firstWarning}
                  </p>
                )}
              </div>
              <span
                className="text-[length:var(--pw-typography-size_micro)] font-medium text-[var(--pw-text-secondary)] shrink-0"
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
  templates: ReturnType<typeof readBrainTemplates>;
  isBrainLoading: boolean;
  endpointCount: number;
  isManifestLoading: boolean;
}) {
  if (isBrainLoading || isManifestLoading) {
    return (
      <SettingsSection id="Brain & Templates" titleId="settings-brain-heading">
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Loading…
        </p>
      </SettingsSection>
    );
  }

  if (templates.length === 0 && endpointCount === 0) {
    return (
      <SettingsSection id="Brain & Templates" titleId="settings-brain-heading">
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          No brain templates configured
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="Brain & Templates" titleId="settings-brain-heading">
      {endpointCount > 0 && (
        <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Worlds offers {endpointCount} API endpoints.
        </p>
      )}

      {templates.length > 0 ? (
        <>
          <p className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
            Templates ({templates.length})
          </p>
          <ul className="space-y-[var(--pw-spacing-sm)]" role="list">
            {templates.map((t, i) => (
              <li
                key={t.id ?? i}
                className="p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]"
              >
                <p className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                  {t.id}
                </p>
                <div className="flex gap-[var(--pw-spacing-md)] mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                  <span>Kind: {t.kind}</span>
                  {t.surface !== null && <span>Surface: {t.surface}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
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
        {/* Read-only honesty: this is a device preference, not a server
            setting — the station publishes themes (GET /api/themes) but
            has no endpoint that records which one you picked. Saying so
            beats pretending the choice persists. */}
        <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Read-only on the server: this station serves theme packs but has no
          endpoint that stores a chosen theme, so this selection is remembered
          on this device only — it returns to the default on a new device.
        </p>
        <div className="grid grid-cols-1 gap-[var(--pw-spacing-md)] min-[480px]:grid-cols-2">
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
                {/* The theme's own colours: tokens scoped by data-theme. */}
                <span
                  aria-hidden="true"
                  data-theme={theme}
                  className="flex h-9 w-14 shrink-0 items-end rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-canvas)] p-[3px]"
                >
                  <span className="h-[5px] w-6 rounded-full bg-[var(--pw-accent-primary)]" />
                </span>
                <span className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                  {THEME_LABELS[theme]}
                </span>
                {isActive && (
                  <span
                    className="ml-auto text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]"
                  >
                    selected
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

export function Settings({
  onOpenCrew,
  onOpenPeople,
}: { onOpenCrew?: () => void; onOpenPeople?: () => void } = {}) {
  const me = useMe();
  const canManagePeople = me.data?.data?.permissions.includes("manage_people") ?? false;
  // Server state
  const { data: status, isLoading: isStatusLoading } = useStatus();
  const { data: session, isLoading: isSessionLoading } = useSession();
  const speaker = useSettingsSpeaker();
  const principalQuery = usePrincipal();
  const { data: brain, isLoading: isBrainLoading } = useBrainTemplates();
  const { data: manifest, isLoading: isManifestLoading } = useManifest();
  const sectionsQuery = useSections();

  const principalName = principalDisplayName(principalQuery.data);

  // Section ordering draft — derived from the server's resolved list,
  // overridden locally until a save lands. Only PERSONAL destinations
  // are offered: the station's registry may advertise more (media,
  // lab, vault…), the skeleton landmarks are fixed by the product
  // contract, and a toggle that could not actually move Overview or
  // Memory would be a lie with a checkbox. Labels come from the
  // client registry — the contract pins UI words, not the server.
  const personalIds = new Set<string>(PERSONAL_AREAS.map((a) => a.id));
  const serverRows: SectionItem[] = readSectionRows(sectionsQuery.data).rows
    .filter((r) => personalIds.has(r.id))
    .map((r) => ({
      id: r.id,
      label: PERSONAL_AREAS.find((a) => a.id === r.id)?.label ?? r.label,
      visible: r.visible,
    }));
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
    applyThemeToDocument(theme);
    saveStoredTheme(theme);
  }, [theme]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-[var(--pw-spacing-md)] focus:left-[var(--pw-spacing-md)] focus:z-50 focus:px-[var(--pw-spacing-lg)] focus:py-[var(--pw-spacing-sm)] focus:bg-[var(--pw-surface-panel)] focus:text-[var(--pw-accent-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)] focus:rounded-[var(--pw-radius-sm)]"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        aria-label="Settings"
        className="relative z-10 p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)] max-w-[720px]"
      >
        <header className="mb-[var(--pw-spacing-2xl)]">
          <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
            Settings
          </h1>
          <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Configure your environment
          </p>
        </header>

        {onOpenCrew && (
          <section
            aria-labelledby="settings-crew-heading"
            className="mb-[var(--pw-spacing-2xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
          >
            {speaker?.crewOn && <CompanionFace name={speaker.name} portrait={speaker.portrait} size="sm" />}
            <div className="min-w-0 flex-1">
              <h2
                id="settings-crew-heading"
                className={`mb-[var(--pw-spacing-xs)] ${SECTION_HEADING}`}
                style={SERIF}
              >
                Your crew
              </h2>
              <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
                {speaker
                  ? speaker.crewOn
                    ? `${speaker.name} is your companion. Add your own, give them pictures, and choose who keeps each room.`
                    : "The crew is off, so Worlds speaks plainly. Add companions and choose who keeps each room."
                  : "Add your own companions, give them pictures, and choose who keeps each room."}
              </p>
            </div>
            <WorldButton variant="primary" onPress={onOpenCrew}>
              Open your crew
            </WorldButton>
          </section>
        )}

        {onOpenPeople && canManagePeople && (
          <section
            aria-labelledby="settings-people-heading"
            className="mb-[var(--pw-spacing-2xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
          >
            <div className="min-w-0 flex-1">
              <h2
                id="settings-people-heading"
                className={`mb-[var(--pw-spacing-xs)] ${SECTION_HEADING}`}
                style={SERIF}
              >
                People in this World
              </h2>
              <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
                Who’s here and what each person can do.
              </p>
            </div>
            <WorldButton onPress={onOpenPeople}>Open people</WorldButton>
          </section>
        )}

        <MessagesSection />

        <ProfileSection
          authenticated={session?.ok === true}
          isSessionLoading={isSessionLoading}
          displayName={principalName}
          isPrincipalLoading={principalQuery.isPending}
        />

        <SettingsRoom />


        <FirstDayToggle />

        <SectionsManager
          serverSections={editableSections}
          onReorder={handleReorderSections}
          onToggle={handleToggleSection}
          onSaved={() => setSectionDraft(null)}
        />

        <CapabilitiesSection
          capabilities={readCapabilityRows(status)}
          isStatusLoading={isStatusLoading}
        />

        <BrainSection
          templates={readBrainTemplates(brain)}
          isBrainLoading={isBrainLoading}
          endpointCount={countManifestEndpoints(manifest)}
          isManifestLoading={isManifestLoading}
        />

        <ThemeSection currentTheme={theme} onSelect={setTheme} />

        {/* Advanced — the secrets Vault, relocated from the old
            top-level "Records" nav slot per the contract's Records vs
            Vault rule. Full tool, unchanged behaviour. */}
        <section
          aria-labelledby="settings-advanced-heading"
          className="mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
        >
          <h2
            id="settings-advanced-heading"
            className={`mb-[var(--pw-spacing-md)] ${SECTION_HEADING}`}
        style={SERIF}
          >
            Advanced
          </h2>
          <p className="mb-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Tools that rarely need a direct visit, kept reachable
            anyway. Your own structured information is Records, inside
            Memory — the Vault below holds credentials and secrets.
          </p>
          <VaultTool />
        </section>
      </main>
    </>
  );
}

/** Brings the Bridge's first-day guide back after it was put away. It
 *  still hides itself once every line is done. */
function FirstDayToggle() {
  const hidden = useFirstDayHidden();
  if (!hidden) return null;
  return (
    <section
      aria-labelledby="settings-firstday-heading"
      className="mb-[var(--pw-spacing-2xl)] flex flex-wrap items-center gap-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <div className="min-w-0 flex-1">
        <h2
          id="settings-firstday-heading"
          className={`mb-[var(--pw-spacing-xs)] ${SECTION_HEADING}`}
                style={SERIF}
        >
          First-day guide
        </h2>
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          You put it away on this device. Bring it back to the Bridge?
        </p>
      </div>
      <WorldButton onPress={() => setFirstDayHidden(false)}>Show the first-day guide</WorldButton>
    </section>
  );
}

/** Who the person's companion is, from the briefing's per-caller
 *  resident (null until it arrives). */
function useSettingsSpeaker(): { name: string; portrait?: string; crewOn: boolean } | null {
  const briefing = useBriefing();
  const resident = briefing.data?.ok === true ? briefing.data.data?.keeper?.resident : undefined;
  if (!resident) return null;
  return {
    name: resident.name,
    portrait: resident.portrait ? `${import.meta.env.BASE_URL}${resident.portrait.replace(/^\//, "")}` : undefined,
    crewOn: resident.key !== null,
  };
}

/** How often the companion may speak up on the Bridge (this device). */
function MessagesSection() {
  const mode = useMessagesMode();
  return (
    <SettingsSection id="Companion messages" titleId="settings-messages-heading">
      <fieldset>
        <legend className="mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          One short line on the Bridge, never on a quiet day. Remembered on this device.
        </legend>
        <div className="flex flex-col gap-[var(--pw-spacing-xs)]">
          {MESSAGES_MODES.map((m) => (
            <label
              key={m.value}
              className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center gap-[var(--pw-spacing-md)] text-[var(--pw-text-primary)]"
            >
              <input
                type="radio"
                name="companion-messages"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMessagesMode(m.value)}
                className="h-5 w-5 accent-[var(--pw-accent-primary)]"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
    </SettingsSection>
  );
}
