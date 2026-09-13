import { useEffect, useState } from "react";
import {
  ApiError,
  deleteVaultSecret,
  lockVault,
  setVaultSecret,
  unlockVault,
} from "../lib/api";
import { useVaultNames, useVaultStatus, useVaultKey } from "../lib/hooks";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { Dialog } from "../primitives/Dialog";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { ErrorState } from "../shell/ErrorState";
import { Button } from "../components/ui/button";
import { Loader2, Sparkles } from "../lib/icons";
import { Icon } from "../lib/icons";

/**
 * VaultScreen (P1 T10, parity row 5, FOUNDATION-SPEC §7; Workshop v3
 * warmth pass 2026-09-13, frame 17:1014 "Vault screen" / AMBIENT-WARM):
 *
 * Status, unlock, lock, names, set, delete — all through the typed
 * client; every write passes through useStepUp() (StepUpPrompt opens on
 * a 403 step_up_required and re-sends with the step-up header).
 *
 * SECURITY (A11y-adjacent, spec §7 row 5): secret VALUES are never
 * requested and never rendered — the screen calls /api/vault/names and
 * /api/vault/set only; the value input is cleared after storing. Delete
 * confirms through the danger Dialog (verb label, consequence named).
 * Status words are StatusChip (canonical vocabulary); unlock/lock
 * outcomes announce through the app LiveRegion (action_completed /
 * error kinds only).
 *
 * Composition (Workshop v3 frame 17:1014): the page keeps the frame's
 * earned-container layout — a "Treasures in safekeeping" panel with
 * raised secret rows (surface.raised/border.strong tokens, treasure
 * marks, per-row Remove pill) beside a "Place a secret inside" panel
 * (visible field labels, reassurance box, solid-teal Store control,
 * the frame's sea-charm line). The heading carries the frame's lock
 * crest and brighter-teal title (accent.primary_bright); the vault
 * status pill keeps CANONICAL status words (the frame's "Vault
 * unlocked" is the healthy case; locked renders the honest chip) with
 * the frame's glow treatment (warmth.vault_glow) and an aria-hidden
 * gold ✦. The frame's guardian illustration and audio-waveform
 * dividers are design-agent art / the reserved waterline family —
 * NOT traced or scattered; deviations recorded in the private mapping
 * ledger. "Added <date>" per secret has no backend truth (vault.py
 * stores name→value only) — the row sub-line renders the honest
 * "Value safely hidden." (row 15: no fabricated metadata).
 *
 * Responsive: two-panel workspace row ≥900px, stacked below
 * (RESPONSIVE_RULES); panels stay earned containers, phone keeps the
 * same content full-width.
 */

function vaultStatusWord(locked: boolean): CanonicalStatus {
  return locked ? "not_configured" : "healthy";
}

/** Page heading (17:1046-1056): lock crest + expressive 40px title in
 * the brighter teal, lede, and the frame's glow status pill. The pill
 * keeps StatusChip's canonical vocabulary; the glow + gold ✦ are
 * decoration (aria-hidden; non-color state = the chip's own label). */
function VaultHeading({
  locked,
  message,
}: {
  locked: boolean;
  message: string;
}) {
  return (
    <section aria-labelledby="vault-page-heading" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden={true}
              className="flex size-[40px] items-center justify-center rounded-full border"
              style={{
                backgroundColor: "var(--pw-color-warmth-teal-wash)",
                borderColor: "var(--pw-color-warmth-teal-wash)",
              }}
            >
              <Icon name="icon-system-device-lock" size={24} className="text-[var(--pw-color-accent-primary)]" />
            </span>
            <h1
              id="vault-page-heading"
              className="text-[34px] leading-[1.1] min-[600px]:text-[40px]"
              style={{
                fontFamily: "var(--pw-typography-font-expressive)",
                color: "var(--pw-color-accent-primary-bright)",
              }}
            >
              Vault
            </h1>
          </div>
          <p className="max-w-[720px] text-[15px] leading-[1.55] text-[var(--pw-color-text-secondary)]">
            Your secrets, sealed on this machine. Names are shown; values never leave the vault.
          </p>
        </div>
        {/* Guardian corner (17:1057): the frame's illustration is
            design-agent art — the warm aura renders as a static token
            glow behind the canonical lock glyph; no artwork traced. */}
        <div aria-hidden={true} className="relative hidden h-[120px] w-[190px] shrink-0 items-center justify-center min-[900px]:flex">
          <span
            className="absolute size-[110px] rounded-full"
            style={{
              background:
                "var(--pw-color-warmth-aura-rose)",
            }}
          />
          <Icon
            name="icon-system-device-lock"
            size={72}
            className="relative text-[var(--pw-color-text-secondary)] opacity-80"
          />
          <span className="absolute right-2 top-1 select-none text-[var(--pw-color-accent-primary-bright)] opacity-50">
            °<br />◦<br />✦
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-[9px] rounded-full border px-3 py-[6px]"
          style={{
            backgroundColor: "var(--pw-color-warmth-teal-wash)",
            borderColor: "var(--pw-color-warmth-teal-wash)",
            boxShadow: "var(--pw-color-warmth-vault-glow)",
          }}
        >
          <StatusChip status={vaultStatusWord(locked)} label="vault" />
          <span aria-hidden="true" className="text-[13px]" style={{ color: "var(--pw-color-accent-gold)" }}>
            ✦
          </span>
        </span>
        <span className="text-sm text-[var(--pw-color-text-secondary)]" role="status">
          {message}
        </span>
      </div>
    </section>
  );
}

function VaultScreen() {
  const status = useVaultStatus();
  const [statusReady, setStatusReady] = useState(false);
  const bumpVault = useVaultKey();
  const { announce } = useAnnounce();
  const stepUp = useStepUp();

  useEffect(() => {
    if (status.data != null) setStatusReady(true);
  }, [status.data]);

  const locked = status.data?.locked ?? true;
  const unlocked = status.data != null && !locked;
  // Names only for an unlocked vault (see useVaultNames): the lock
  // state arrives from /api/vault/status; until then `locked` is the
  // honest default (true) and the names query stays disabled.
  const names = useVaultNames(statusReady ? locked : true);

  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [setName, setSetName] = useState("");
  const [setValue, setSetValue] = useState("");
  const [storing, setStoring] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const unlock = async () => {
    if (!passphrase || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await stepUp.withStepUp(() => unlockVault(passphrase));
      setPassphrase("");
      setMessage("Vault unlocked.");
      announce("Vault unlocked.", { kind: "action_completed", key: "vault-unlocked" });
      // Status first: its fresh `locked:false` re-enables the names
      // query (useVaultNames gate), so this refetch actually fetches.
      await status.refetch();
      await names.refetch();
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage("Unlock cancelled — the vault stays locked.");
      } else {
        const detail = e instanceof ApiError && e.detail ? e.detail : null;
        setMessage(detail ?? "Unlock failed. Check the passphrase and try again.");
        announce("Unlock failed. The vault stays locked.", { kind: "error", key: "vault-unlock-failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await stepUp.withStepUp(() => lockVault());
      setMessage("Vault locked. Your secrets are sealed.");
      announce("Vault locked.", { kind: "action_completed", key: "vault-locked" });
      await status.refetch();
      await Promise.all([bumpVault(), names.refetch()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage("Lock cancelled — the vault stays unlocked.");
      } else {
        setMessage("Could not lock the vault just now. Try again.");
        announce("Lock failed. The vault stays unlocked.", { kind: "error", key: "vault-lock-failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const store = async () => {
    const name = setName.trim();
    if (!name || !setValue || storing) return;
    setStoring(true);
    setMessage("");
    try {
      await stepUp.withStepUp(() => setVaultSecret(name, setValue));
      setSetName("");
      setSetValue("");
      setMessage(`Stored "${name}".`);
      announce(`Secret ${name} stored.`, { kind: "action_completed", key: "vault-stored" });
      await Promise.all([names.refetch(), bumpVault()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage("Store cancelled — nothing was saved.");
      } else {
        setMessage("That secret was not stored. Try again.");
        announce("Store failed. Nothing was saved.", { kind: "error", key: "vault-store-failed" });
      }
    } finally {
      setStoring(false);
    }
  };

  const confirmDelete = async () => {
    const name = pendingDelete;
    if (!name || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await stepUp.withStepUp(() => deleteVaultSecret(name));
      setMessage(`Deleted "${name}".`);
      announce(`Secret ${name} deleted.`, { kind: "action_completed", key: "vault-deleted" });
      setPendingDelete(null);
      await Promise.all([bumpVault(), names.refetch()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage(`Delete cancelled — "${name}" is still stored.`);
      } else {
        setMessage("Could not delete that secret just now. Try again.");
        announce("Delete failed. The secret is still stored.", { kind: "error", key: "vault-delete-failed" });
      }
    } finally {
      setDeleteBusy(false);
      setPendingDelete(null);
    }
  };

  if (status.isLoading) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-[var(--pw-color-text-muted)]" role="status">
          <Loader2 size={16} aria-hidden={true} className="loader-static" />
          Checking the vault…
        </p>
      </div>
    );
  }

  if (status.isError) {
    return (
      <div>
        <ErrorState
          title="Vault"
          headingLevel={1}
          failed="could not reach the vault"
          detail={status.error instanceof ApiError ? status.error.detail : null}
          onRetry={() => void status.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stepUp.prompt}
      <VaultHeading locked={locked} message={message} />

      {/* Unlock / lock (17:1105-1109 for the unlocked side; the locked
          form keeps its own honest section) */}
      {!unlocked ? (
        <section
          aria-labelledby="vault-access-heading"
          className="space-y-3 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]"
        >
          <div className="space-y-1">
            <h2
              id="vault-access-heading"
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
            >
              Unlock your vault
            </h2>
            <p className="text-sm text-[var(--pw-color-text-muted)]">
              Enter your master passphrase to reach your secrets on this device.
            </p>
          </div>
          <div className="max-w-[420px] space-y-3">
            <label htmlFor="vault-passphrase" className="sr-only">
              Master passphrase
            </label>
            <input
              id="vault-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-canvas)] px-4 text-[var(--pw-color-text-primary)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <Button type="button" onClick={() => void unlock()} disabled={!passphrase || busy}>
              Unlock vault
            </Button>
          </div>
        </section>
      ) : null}

      {/* Names + set (only when unlocked) — the frame's two-panel
          workspace (17:1062): Treasures | Store. DOM order (list,
          then store form) is the semantic source order; the grid is
          ≥900px only. */}
      {unlocked ? (
        <div className="grid gap-6 min-[900px]:grid-cols-[1fr_398px] min-[900px]:items-start">
          <section
            aria-labelledby="vault-names-heading"
            className="rounded-3xl border border-[var(--pw-color-border-strong)] p-[22px]"
            style={{
              backgroundColor: "var(--pw-color-vault-panel-translucent)",
              boxShadow: "var(--pw-color-warmth-panel-shadow)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2
                  id="vault-names-heading"
                  className="text-xl text-[var(--pw-color-text-primary)]"
                  style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
                >
                  Treasures in safekeeping
                </h2>
                <p className="text-[11px] text-[var(--pw-color-text-secondary)]" aria-live="polite">
                  {(names.data?.names ?? []).length} sealed{" "}
                  {(names.data?.names ?? []).length === 1 ? "secret" : "secrets"}
                </p>
              </div>
              <span aria-hidden="true" className="text-[var(--pw-color-text-muted)]">
                <Icon name="icon-status-feedback-offline" size={26} />
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {names.isLoading ? (
                <p className="text-[var(--pw-color-text-muted)]" role="status">
                  Opening the list…
                </p>
              ) : names.isError ? (
                <p className="text-[var(--pw-color-text-primary)]">
                  {names.error instanceof ApiError && names.error.detail
                    ? names.error.detail
                    : "The names list could not be opened."}
                </p>
              ) : (names.data?.names ?? []).length === 0 ? (
                <p className="text-[var(--pw-color-text-secondary)]">
                  No secrets stored yet. Add one below.
                </p>
              ) : (
                <ul className="space-y-3" role="list">
                  {(names.data?.names ?? []).map((name) => (
                    <li
                      key={name}
                      className="flex min-h-[70px] items-center gap-[14px] rounded-xl border border-[var(--pw-color-border-strong)] bg-[var(--pw-color-surface-raised)] px-[18px] py-3"
                    >
                      <span
                        aria-hidden={true}
                        className="flex size-[38px] shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: "var(--pw-color-warmth-rose-wash)" }}
                      >
                        <Icon name="icon-world-content-tag" size={19} className="text-[var(--pw-color-accent-secondary)]" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-[15px] font-semibold text-[var(--pw-color-text-primary)]">
                          {name}
                        </p>
                        <p className="text-[11px] text-[var(--pw-color-text-secondary)]">
                          Value safely hidden
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(name)}
                        aria-label={`Delete secret ${name}`}
                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--pw-color-border-strong)] px-4 text-[13px] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{
                          backgroundColor: "var(--pw-color-warmth-rose-wash-soft)",
                          color: "var(--pw-color-accent-secondary)",
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Seal action (17:1105-1109): warm framing sentence +
                literal Lock vault control. */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-0 pt-2">
              <p className="max-w-[300px] text-[11px] leading-[1.4] text-[var(--pw-color-text-secondary)]">
                Finished for now? She'll keep watch from the other side.
              </p>
              <button
                type="button"
                onClick={() => void lock()}
                disabled={busy}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--pw-color-border-strong)] bg-[var(--pw-color-warmth-glass-pill)] px-4 text-[13px] text-[var(--pw-color-text-primary)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
              >
                <Icon name="icon-system-device-lock" size={17} aria-hidden={true} />
                Lock vault
              </button>
            </div>
          </section>

          <section
            aria-labelledby="vault-set-heading"
            className="rounded-3xl border border-[var(--pw-color-vault-store-border)] p-6"
            style={{
              backgroundColor: "var(--pw-color-vault-store-panel)",
              boxShadow: "var(--pw-color-warmth-panel-shadow)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2
                  id="vault-set-heading"
                  className="text-2xl"
                  style={{
                    fontFamily: "var(--pw-typography-font-expressive)",
                    color: "var(--pw-color-accent-secondary)",
                  }}
                >
                  Place a secret inside
                </h2>
                <p className="max-w-[290px] text-[13px] leading-[1.45] text-[var(--pw-color-text-secondary)]">
                  A small safe place for something precious.
                </p>
              </div>
              <p aria-hidden="true" className="select-none text-[27px]" style={{ color: "var(--pw-color-accent-gold)" }}>
                ◖✦◗
              </p>
            </div>
            <div className="mt-5 space-y-4">
              <div className="space-y-[7px]">
                <label
                  htmlFor="vault-secret-name"
                  className="text-[13px] font-semibold text-[var(--pw-color-text-primary)]"
                >
                  Secret name
                </label>
                <input
                  id="vault-secret-name"
                  type="text"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="Give it a name you will recognize"
                  autoComplete="off"
                  className="h-12 w-full rounded-xl border border-[var(--pw-color-vault-input-border)] bg-[var(--pw-color-surface-canvas)] px-4 text-[13px] text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-secondary)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
                />
              </div>
              <div className="space-y-[7px]">
                <label
                  htmlFor="vault-secret-value"
                  className="text-[13px] font-semibold text-[var(--pw-color-text-primary)]"
                >
                  Secret value
                </label>
                <input
                  id="vault-secret-value"
                  type="password"
                  value={setValue}
                  onChange={(e) => setSetValue(e.target.value)}
                  placeholder="Paste it here — we won't peek"
                  autoComplete="off"
                  className="h-12 w-full rounded-xl border border-[var(--pw-color-vault-input-border)] bg-[var(--pw-color-surface-canvas)] px-4 text-[13px] text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-secondary)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
                />
              </div>
              <div
                className="flex items-start gap-[10px] rounded-xl p-3"
                style={{ backgroundColor: "var(--pw-color-warmth-teal-reassure)" }}
              >
                <Icon name="icon-people-community-person" size={18} aria-hidden={true} className="mt-[1px] shrink-0 text-[var(--pw-color-accent-primary)]" />
                <p className="text-[11px] leading-[1.45] text-[var(--pw-color-text-secondary)]">
                  Encrypted locally. It stays on this machine, tucked safely out of sight.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--pw-color-text-muted)]" role="status">
                  {storing ? "Storing…" : ""}
                </span>
                <Button
                  type="button"
                  onClick={() => void store()}
                  disabled={!setName.trim() || !setValue || storing}
                  className="gap-2 rounded-full"
                >
                  <Sparkles size={17} aria-hidden={true} />
                  Store secret
                </Button>
              </div>
            </div>
            {/* The frame's sea-charm (17:1136): warmth framing stays
                real text (Young Serif, gold), controls stay literal. */}
            <p
              className="mt-6 text-center text-[14px]"
              style={{ fontFamily: "var(--pw-typography-font-expressive)", color: "var(--pw-color-accent-gold)", opacity: 0.44 }}
            >
              ·  the sea keeps what it is told  ·
            </p>
          </section>
        </div>
      ) : null}

      {/* Danger confirm: verb label, consequence named (A11y §4.4) */}
      <Dialog
        open={pendingDelete !== null}
        title="Delete this secret?"
        description={
          pendingDelete
            ? `Deleting "${pendingDelete}" removes it permanently from the vault. Anything that relied on it will stop working, and this cannot be undone.`
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        confirmLabel={deleteBusy ? "Deleting…" : "Delete secret"}
        danger={true}
        initialFocus="cancel"
      />
    </div>
  );
}

export default VaultScreen;