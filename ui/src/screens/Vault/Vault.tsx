/**
 * VaultTool — Secrets and provider-credentials tool, embedded in
 * Settings (the contract's "advanced area").
 *
 * docs/PRODUCT-LANGUAGE.md: Vault is security/secrets INFRASTRUCTURE
 * — credentials, tokens, keys, step-up-protected material — and
 * "rarely needs a direct user-facing presence". It is not Memory's
 * Records, and it lost its top-level navigation slot with that
 * distinction. Nothing else about it changed: every endpoint
 * (status / names / secret read / unlock / lock / set / delete) and
 * the whole lock UX work exactly as they did as a standalone screen.
 *
 * All data flows through the typed hook layer (src/data/hooks.ts →
 * src/data/api.ts → generated OpenAPI contract). The contract for
 * /api/vault/* is `{name, value}` bodies and an `{ok, data}` envelope —
 * the hand-rolled `{key, value}` fetch this screen used before violated
 * it. There is no secret_count on the status endpoint; the count is
 * derived from the names list.
 *
 * Delete confirmation is a native <dialog> with showModal(): modal,
 * focus trapped, initial focus on the safe action, Escape cancels,
 * background inert, focus returns to the invoking control (§3.3).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useStatus,
  useVaultStatus,
  useVaultNames,
  useUnlockVault,
  useLockVault,
  useSetVaultSecret,
  useDeleteVaultSecret,
} from "../../data/hooks";
import { describeError } from "../../data/errors";
import { STATUS_LABELS, toCapabilityStatus } from "../../data/types";

// ─── Button classes (shared by the screen; motion guarded per §6.2) ──────

const BTN_BASE =
  "inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium " +
  "transition-colors duration-150 motion-reduce:transition-none " +
  "min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] " +
  "py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)]";

const BTN_PLAIN =
  `${BTN_BASE} px-[var(--pw-spacing-lg)] bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] ` +
  "border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)]";

const BTN_PLAIN_SM =
  `${BTN_BASE} px-[var(--pw-spacing-md)] bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] ` +
  "border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)]";

const BTN_WARM =
  `${BTN_BASE} px-[var(--pw-spacing-lg)] bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)] ` +
  "hover:brightness-110 active:brightness-90";

const BTN_CORAL =
  `${BTN_BASE} px-[var(--pw-spacing-lg)] bg-[var(--pw-accent-coral)] text-[var(--pw-surface-void)] ` +
  "hover:brightness-110 active:brightness-90";

const INPUT_BASE =
  "w-full rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] " +
  "px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] " +
  "text-[var(--pw-text-primary)] min-h-[var(--pw-targets-minimum)] " +
  "focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";

// ─── Component ────────────────────────────────────────────

export function VaultTool() {
  const statusQuery = useStatus();
  const vaultStatusQuery = useVaultStatus();
  const vaultLocked = vaultStatusQuery.data?.data?.locked ?? true;
  const encrypted = vaultStatusQuery.data?.data?.encrypted ?? false;

  // The backend answers 409 on /names while the vault is locked.
  const namesQuery = useVaultNames({ enabled: !vaultLocked });
  const secretNames = namesQuery.data?.data?.names ?? [];

  const unlockVault = useUnlockVault();
  const lockVault = useLockVault();
  const setSecret = useSetVaultSecret();
  const deleteSecret = useDeleteVaultSecret();

  // Unlock form state
  const [passphrase, setPassphrase] = useState("");

  // Secret form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // List-level notice for failures that happen outside the form (delete)
  const [listNotice, setListNotice] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Native modal dialog lifecycle + focus return (§3.3)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (deleteTarget) {
      if (!dialog.open) {
        dialog.showModal(); // moves focus in; traps Tab; makes background inert
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      const trigger = triggerRef.current;
      triggerRef.current = null;
      trigger?.focus();
    }
  }, [deleteTarget]);

  const closeDeleteDialog = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const openForm = useCallback(
    (name: string | null) => {
      setEditingName(name);
      setFormKey(name ?? "");
      setFormValue("");
      setFormError(null);
      setListNotice(null);
      setSecret.reset();
      setFormOpen(true);
    },
    [setSecret],
  );

  const handleFormCancel = useCallback(() => {
    setFormOpen(false);
    setEditingName(null);
    setFormKey("");
    setFormValue("");
    setFormError(null);
    setSecret.reset();
  }, [setSecret]);

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!formKey.trim()) {
        setFormError("Secret name is required");
        return;
      }
      if (!formValue.trim() && !editingName) {
        setFormError("Secret value is required");
        return;
      }
      if (editingName && !formValue.trim()) {
        // The placeholder promises blank keeps the current value —
        // posting "" here would overwrite the secret with an empty
        // string. Nothing to change: close honestly instead.
        handleFormCancel();
        return;
      }
      // Contract body: {name, value}. Step-up 403 surfaces as an inline
      // message instead of a silent failure.
      setSecret.mutate(
        { name: formKey.trim(), value: formValue },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingName(null);
            setFormKey("");
            setFormValue("");
            setFormError(null);
          },
          onError: (err) => {
            setFormError(describeError(err, "Failed to save secret"));
          },
        },
      );
    },
    [formKey, formValue, editingName, setSecret, handleFormCancel],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteSecret.mutate(deleteTarget, {
      onSuccess: () => {
        setListNotice(null);
        closeDeleteDialog();
      },
      onError: (err) => {
        setListNotice(describeError(err, `Failed to delete ${deleteTarget}`));
        closeDeleteDialog();
      },
    });
  }, [deleteTarget, deleteSecret, closeDeleteDialog]);

  const handleUnlockSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!passphrase) return;
      unlockVault.mutate(passphrase, {
        onSuccess: () => {
          setPassphrase("");
          setListNotice(null);
        },
        onError: (err) => {
          setListNotice(describeError(err, "Unlock failed."));
        },
      });
    },
    [passphrase, unlockVault],
  );

  const handleLock = useCallback(() => {
    lockVault.mutate(undefined, {
      onSuccess: () => setListNotice(null),
      onError: (err) =>
        setListNotice(describeError(err, "Lock failed.")),
    });
  }, [lockVault]);

  // Click on the backdrop area (the dialog box itself, outside the panel)
  const handleDialogBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        closeDeleteDialog();
      }
    },
    [closeDeleteDialog],
  );

  // Derive capabilities from the live status envelope ({ok, status, data}).
  const capabilities = statusQuery.data?.data
    ? Object.entries(statusQuery.data.data.capabilities ?? {}).map(([id, cap]) => ({
        id,
        name: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        status: toCapabilityStatus(cap.status),
        warnings: cap.warnings,
      }))
    : [];

  // ─── Loading / error states ───────────────────────────────

  if (vaultStatusQuery.isPending) {
    return (
      <section className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]" aria-label="Vault">
        <h2 className="text-[var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]">
          Vault
        </h2>
        <p className="mt-[var(--pw-spacing-md)] text-[var(--pw-text-muted)]">Loading…</p>
      </section>
    );
  }

  if (vaultStatusQuery.isError) {
    return (
      <section className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]" aria-label="Vault">
        <h2 className="text-[var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]">
          Vault
        </h2>
        <p className="mt-[var(--pw-spacing-md)] text-[var(--pw-text-secondary)]">
          Unable to load vault.
        </p>
        <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          {describeError(vaultStatusQuery.error, "Vault status request failed.")}
        </p>
      </section>
    );
  }

  // ─── Main render ───────────────────────────────────────────

  return (
    <>
      {/* Embedded in Settings: no skip link and no <main> of its own —
          Settings owns the landmark order; this is a named region. */}
      <section
        className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-lg)]"
        aria-label="Vault"
      >
        {/* Header */}
        <header className="mb-[var(--pw-spacing-2xl)]">
          <h2 className="text-[var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]">
            Vault
          </h2>
          <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Secrets and provider credentials — tokens, keys, step-up
            material. This is infrastructure, not your own records:
            durable personal information lives in Memory under Records.
          </p>
        </header>

        {/* Vault Status */}
        <section
          aria-label="Vault status"
          className="mb-[var(--pw-spacing-2xl)] p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]"
        >
          <div className="flex flex-col gap-[var(--pw-spacing-md)] sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
                {vaultLocked ? "Vault locked" : "Vault unlocked"}
              </p>
              <div className="flex flex-wrap gap-[var(--pw-spacing-lg)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
                <span>
                  {encrypted ? "Encrypted" : "Not encrypted"}
                </span>
                {/* The status endpoint reports no count; only the unlocked
                    names list can say how many secrets exist. */}
                {!vaultLocked && (
                  <span>
                    {namesQuery.isPending
                      ? "Counting secrets…"
                      : `${secretNames.length} ${secretNames.length === 1 ? "secret" : "secrets"}`}
                  </span>
                )}
              </div>
            </div>
            {vaultLocked ? (
              <form
                onSubmit={handleUnlockSubmit}
                className="flex items-center gap-[var(--pw-spacing-md)]"
              >
                <label htmlFor="vault-passphrase" className="sr-only">
                  Vault passphrase
                </label>
                <input
                  id="vault-passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className={`${INPUT_BASE} max-w-[240px]`}
                  placeholder="Passphrase"
                  autoComplete="current-password"
                  aria-describedby={unlockVault.isError ? "vault-unlock-error" : undefined}
                />
                <button
                  type="submit"
                  disabled={unlockVault.isPending || !passphrase}
                  className={`${BTN_PLAIN} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {unlockVault.isPending ? "Unlocking…" : "Unlock"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={handleLock}
                disabled={lockVault.isPending}
                className={`${BTN_PLAIN} disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Lock vault"
              >
                {lockVault.isPending ? "Locking…" : "Lock"}
              </button>
            )}
          </div>
          {vaultStatusQuery.data?.data?.warning && (
            <p className="mt-[var(--pw-spacing-md)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]" role="note">
              {vaultStatusQuery.data.data.warning}
            </p>
          )}
        </section>

        {/* Action notices */}
        {listNotice && (
          <p
            role="alert"
            className="mb-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
          >
            {listNotice}
            <button
              type="button"
              onClick={() => setListNotice(null)}
              className="ml-[var(--pw-spacing-md)] text-[var(--pw-accent-primary)] underline"
            >
              Dismiss
            </button>
          </p>
        )}

        {/* Secrets section */}
        <section aria-label="Secrets" className="mb-[var(--pw-spacing-2xl)]">
          <div className="flex items-center justify-between mb-[var(--pw-spacing-md)]">
            <h3 className="text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
              Secrets
            </h3>
            {!vaultLocked && (
              <button
                type="button"
                onClick={() => openForm(null)}
                className={BTN_WARM}
                aria-label="Add new secret"
              >
                Add secret
              </button>
            )}
          </div>

          {vaultLocked ? (
            /* Locked state */
            <div className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] text-center">
              <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]">
                Unlock the vault to view secrets.
              </p>
            </div>
          ) : namesQuery.isLoading ? (
            /* Loading state */
            <div className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]">
              <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                Loading…
              </p>
            </div>
          ) : namesQuery.isError ? (
            /* Error state */
            <div className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]">
              <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
                {describeError(namesQuery.error, "Failed to load secret names")}
              </p>
            </div>
          ) : secretNames.length === 0 ? (
            /* Empty state */
            <div className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] text-center">
              <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-muted)]">
                Your vault is empty. Add secrets to get started.
              </p>
            </div>
          ) : (
            /* Secret list */
            <div className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]">
              <ul className="divide-y divide-[var(--pw-border-subtle)]">
                {secretNames.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)]"
                  >
                    <span className="min-w-0 flex-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-primary)] truncate">
                      {name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openForm(name)}
                      className={BTN_PLAIN_SM}
                      aria-label={`Edit secret ${name}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        triggerRef.current = e.currentTarget;
                        setDeleteTarget(name);
                      }}
                      className={`${BTN_PLAIN_SM} text-[var(--pw-accent-coral)]`}
                      aria-label={`Delete secret ${name}`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Add/Edit secret form */}
        {formOpen && (
          <section
            aria-label={editingName ? "Edit secret" : "Add secret"}
            className="mb-[var(--pw-spacing-2xl)] p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]"
          >
            <h3 className="text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)] mb-[var(--pw-spacing-md)]">
              {editingName ? "Edit secret" : "Add secret"}
            </h3>
            <form onSubmit={handleFormSubmit}>
              <div className="space-y-[var(--pw-spacing-md)]">
                <div>
                  <label
                    htmlFor="vault-secret-name"
                    className="block text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)] mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="vault-secret-name"
                    type="text"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    disabled={!!editingName}
                    readOnly={!!editingName}
                    className={`${INPUT_BASE} disabled:opacity-50 disabled:cursor-not-allowed`}
                    placeholder="e.g. API_KEY"
                    required
                    aria-label="Secret name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="vault-secret-value"
                    className="block text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)] mb-1"
                  >
                    Value
                  </label>
                  <input
                    id="vault-secret-value"
                    type="password"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className={INPUT_BASE}
                    placeholder={editingName ? "New value (leave blank to keep current)" : "Enter secret value"}
                    required={!editingName}
                    aria-label="Secret value"
                  />
                </div>
                {formError && (
                  <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-accent-coral)]" role="alert">
                    {formError}
                  </p>
                )}
                <div className="flex gap-[var(--pw-spacing-md)]">
                  <button
                    type="submit"
                    disabled={setSecret.isPending}
                    className={`${BTN_WARM} disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label={editingName ? "Save changes" : "Save secret"}
                  >
                    {setSecret.isPending ? "Saving…" : editingName ? "Save changes" : "Save secret"}
                  </button>
                  <button
                    type="button"
                    onClick={handleFormCancel}
                    disabled={setSecret.isPending}
                    className={`${BTN_PLAIN} disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                </div>
                <p
                  className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] italic"
                  role="note"
                >
                  Saving a secret requires step-up authentication
                </p>
              </div>
            </form>
          </section>
        )}

        {/* Provider configuration */}
        <section aria-label="Provider configuration">
          <h3 className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
            Providers
          </h3>
          <div className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
            {statusQuery.isLoading ? (
              <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                Loading…
              </p>
            ) : capabilities.length === 0 ? (
              <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                No providers configured.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--pw-spacing-md)]">
                {capabilities.map((cap) => (
                  <div
                    key={cap.id}
                    className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)]"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)] truncate">
                        {cap.name}
                      </p>
                      {cap.warnings && cap.warnings.length > 0 && (
                        <p className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] truncate">
                          {cap.warnings[0]}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)] shrink-0"
                      aria-label={`Status: ${STATUS_LABELS[cap.status]}`}
                    >
                      {STATUS_LABELS[cap.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      {/* Delete confirmation — native modal dialog (§3.3). Hidden until
          showModal(); open:grid restores the centered layout while open. */}
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
        onClick={handleDialogBackdropClick}
        onCancel={(e) => {
          // Escape — cancel is the safe action: nothing deleted.
          e.preventDefault();
          closeDeleteDialog();
        }}
        className="hidden open:grid fixed inset-0 z-50 m-0 h-full max-h-full w-full max-w-full place-items-center bg-black/60 pt-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-top))] pr-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-right))] pb-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-bottom))] pl-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-left))] text-[var(--pw-text-primary)]"
      >
        <div
          className="w-full max-w-md rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-xl)] mx-[var(--pw-spacing-xl)]"
        >
          <h2
            id="delete-dialog-title"
            className="text-[var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]"
          >
            Delete secret
          </h2>
          <p
            id="delete-dialog-desc"
            className="mt-[var(--pw-spacing-md)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
          >
            Are you sure you want to delete{" "}
            <span className="font-medium text-[var(--pw-text-primary)]">{deleteTarget}</span>?
            This cannot be undone.
          </p>
          <div className="mt-[var(--pw-spacing-xl)] flex justify-end gap-[var(--pw-spacing-md)]">
            <button
              type="button"
              onClick={closeDeleteDialog}
              className={BTN_PLAIN}
              aria-label="Cancel delete"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleteSecret.isPending}
              className={`${BTN_CORAL} disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={`Confirm delete secret ${deleteTarget ?? ""}`}
            >
              {deleteSecret.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
