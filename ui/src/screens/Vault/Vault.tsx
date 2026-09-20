/**
 * Vault — Secret and provider configuration screen.
 *
 * Manages encrypted secrets and displays connected provider capabilities.
 * Uses direct fetch calls since vault endpoints are not yet in the
 * generated OpenAPI spec.
 */

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react";
import { useStatus } from "../../data/hooks";
import { STATUS_LABELS, type CapabilityStatus } from "../../data/types";

// ─── Vault API (not in generated spec yet) ────────────────

interface VaultStatusResponse {
  locked: boolean;
  encrypted: boolean;
  secret_count: number;
}

const VAULT_BASE = "/api/vault";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${VAULT_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Vault request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function useVaultStatus() {
  const [data, setData] = useState<VaultStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await apiFetch<VaultStatusResponse>("/status");
      setData(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vault status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

function useVaultNames(locked: boolean) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (locked) {
      setNames([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<string[]>("/names");
      setNames(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secret names");
    } finally {
      setLoading(false);
    }
  }, [locked]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { names, loading, error, refresh };
}

// ─── Component ────────────────────────────────────────────

export function Vault() {
  const statusQuery = useStatus();
  const vaultStatus = useVaultStatus();
  const [locked, setLocked] = useState(true);
  const secretNames = useVaultNames(locked);

  // Secret form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button when delete dialog opens
  useEffect(() => {
    if (deleteTarget && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [deleteTarget]);

  const handleUnlock = useCallback(async () => {
    try {
      await apiFetch("/unlock", { method: "POST" });
      setLocked(false);
      await vaultStatus.refresh();
    } catch {
      // status will reflect locked state
    }
  }, [vaultStatus]);

  const handleLock = useCallback(async () => {
    try {
      await apiFetch("/lock", { method: "POST" });
      setLocked(true);
      await vaultStatus.refresh();
    } catch {
      // status will reflect locked state
    }
  }, [vaultStatus]);

  const handleToggleLock = useCallback(() => {
    if (locked) {
      void handleUnlock();
    } else {
      void handleLock();
    }
  }, [locked, handleUnlock, handleLock]);

  const handleAddNew = useCallback(() => {
    setEditingName(null);
    setFormKey("");
    setFormValue("");
    setFormError(null);
    setFormOpen(true);
  }, []);

  const handleEditSecret = useCallback((name: string) => {
    setEditingName(name);
    setFormKey(name);
    setFormValue("");
    setFormError(null);
    setFormOpen(true);
  }, []);

  const handleFormCancel = useCallback(() => {
    setFormOpen(false);
    setEditingName(null);
    setFormKey("");
    setFormValue("");
    setFormError(null);
  }, []);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim()) {
      setFormError("Secret name is required");
      return;
    }
    if (!formValue.trim() && !editingName) {
      setFormError("Secret value is required");
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      await apiFetch("/set", {
        method: "POST",
        body: JSON.stringify({ key: formKey.trim(), value: formValue }),
      });
      setFormOpen(false);
      setEditingName(null);
      setFormKey("");
      setFormValue("");
      await secretNames.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save secret");
    } finally {
      setFormSubmitting(false);
    }
  }, [formKey, formValue, editingName, secretNames]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/${encodeURIComponent(deleteTarget)}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      await secretNames.refresh();
      await vaultStatus.refresh();
    } catch {
      // Delete failed — dialog closes, list may be stale
      setDeleteTarget(null);
    }
  }, [deleteTarget, secretNames, vaultStatus]);

  const handleDeleteDialogKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setDeleteTarget(null);
    }
  }, []);

  // Derive capabilities from status query
  const capabilities = statusQuery.data
    ? Object.entries(statusQuery.data.capabilities || {}).map(([id, cap]) => ({
        id,
        name: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        status: (cap as { status?: string }).status || "unknown",
        warnings: (cap as { warnings?: string[] }).warnings,
      }))
    : [];

  // ─── Loading / error states ───────────────────────────────

  if (vaultStatus.loading && !vaultStatus.data) {
    return (
      <main id="main-content" className="relative z-10 p-[var(--pw-spacing-xl)]" aria-label="Vault">
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Vault
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-muted)]">Loading…</p>
      </main>
    );
  }

  if (vaultStatus.error) {
    return (
      <main id="main-content" className="relative z-10 p-[var(--pw-spacing-xl)]" aria-label="Vault">
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Vault
        </h1>
        <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-secondary)]">
          Unable to load vault.
        </p>
        <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          {vaultStatus.error}
        </p>
      </main>
    );
  }

  const vaultLocked = vaultStatus.data?.locked ?? true;
  const encrypted = vaultStatus.data?.encrypted ?? false;
  const secretCount = vaultStatus.data?.secret_count ?? 0;

  // ─── Main render ───────────────────────────────────────────

  return (
    <>
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-[var(--pw-radius-sm)] focus:bg-[var(--pw-surface-panel)] focus:p-[var(--pw-spacing-md)] focus:text-[var(--pw-text-primary)] focus:outline-2 focus:outline-[#72b1b1]"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        className="relative z-10 p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)] max-w-[720px]"
        aria-label="Vault"
      >
        {/* Header */}
        <header className="mb-[var(--pw-spacing-2xl)]">
          <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
            Vault
          </h1>
          <p className="mt-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Manage secrets and provider configurations
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
                <span>
                  {secretCount} {secretCount === 1 ? "secret" : "secrets"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleLock}
              className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)]"
              aria-label={vaultLocked ? "Unlock vault" : "Lock vault"}
            >
              {vaultLocked ? "Unlock" : "Lock"}
            </button>
          </div>
        </section>

        {/* Secrets section */}
        <section aria-label="Secrets" className="mb-[var(--pw-spacing-2xl)]">
          <div className="flex items-center justify-between mb-[var(--pw-spacing-md)]">
            <h2 className="text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
              Secrets
            </h2>
            {!vaultLocked && (
              <button
                type="button"
                onClick={handleAddNew}
                className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)] hover:brightness-110 active:brightness-90"
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
          ) : secretNames.loading ? (
            /* Loading state */
            <div className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]">
              <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
                Loading…
              </p>
            </div>
          ) : secretNames.error ? (
            /* Error state */
            <div className="p-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]">
              <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
                {secretNames.error}
              </p>
            </div>
          ) : secretNames.names.length === 0 ? (
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
                {secretNames.names.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-[var(--pw-spacing-md)] p-[var(--pw-spacing-md)]"
                  >
                    <span className="min-w-0 flex-1 text-[var(--pw-typography-size_small)] text-[var(--pw-text-primary)] truncate">
                      {name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEditSecret(name)}
                      className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)]"
                      aria-label={`Edit secret ${name}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(name)}
                      className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-surface-panel)] text-[var(--pw-accent-coral)] border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)]"
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
            <h2 className="text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)] mb-[var(--pw-spacing-md)]">
              {editingName ? "Edit secret" : "Add secret"}
            </h2>
            <form onSubmit={void handleFormSubmit}>
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
                    className="w-full rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-primary)] min-h-[var(--pw-targets-minimum)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-2 focus:outline-[#72b1b1]"
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
                    className="w-full rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-primary)] min-h-[var(--pw-targets-minimum)] focus:outline-2 focus:outline-[#72b1b1]"
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
                    disabled={formSubmitting}
                    className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)] hover:brightness-110 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={editingName ? "Save changes" : "Save secret"}
                  >
                    {formSubmitting ? "Saving…" : editingName ? "Save changes" : "Save secret"}
                  </button>
                  <button
                    type="button"
                    onClick={handleFormCancel}
                    disabled={formSubmitting}
                    className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)] disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {/* Provider configuration */}
        <section aria-label="Provider configuration">
          <h2 className="mb-[var(--pw-spacing-md)] text-[var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
            Providers
          </h2>
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
                      aria-label={`Status: ${STATUS_LABELS[cap.status as CapabilityStatus] || "Unknown"}`}
                    >
                      {STATUS_LABELS[cap.status as CapabilityStatus] || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="presentation"
          onKeyDown={handleDeleteDialogKeyDown}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
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
                ref={cancelRef}
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-surface-panel)] text-[var(--pw-text-primary)] border border-[var(--pw-border-subtle)] hover:bg-[var(--pw-surface-elevated)] active:bg-[var(--pw-surface-hull)]"
                aria-label="Cancel delete"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={void handleConfirmDelete}
                className="inline-flex items-center justify-center rounded-[var(--pw-radius-sm)] font-medium transition-colors duration-150 min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] bg-[var(--pw-accent-coral)] text-[var(--pw-surface-void)] hover:brightness-110 active:brightness-90"
                aria-label={`Confirm delete secret ${deleteTarget}`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
