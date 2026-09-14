import { useState } from "react";
import { ApiError } from "../lib/api";
import { useVaultStatus, useVaultNames, useVaultKey } from "../lib/hooks";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { StatusChip } from "../primitives/StatusChip";
import { Dialog } from "../primitives/Dialog";
import { CompanionSlot } from "../primitives/CompanionSlot";
import "./vault-screen.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pw_token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-PW-StepUp": "1",
  };
}

export default function VaultScreen() {
  const vault = useVaultStatus();
  const vaultData = vault.data;
  const locked = vaultData?.locked ?? true;

  const names = useVaultNames(locked);

  const vaultKey = useVaultKey();
  const { announce } = useAnnounce();
  const { withStepUp, prompt: stepUpPrompt } = useStepUp();

  const [passphrase, setPassphrase] = useState("");
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const secretNames: string[] = names.data?.names ?? [];

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const pp = passphrase.trim();
    if (!pp) return;
    try {
      const res = await fetch(`${API_BASE}/api/vault/unlock`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ passphrase: pp }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(
          res.status,
          res.status === 403 ? "forbidden" : "http_error",
          body?.detail ?? `Unlock failed (${res.status}).`,
          { detail: body?.detail, body }
        );
      }
      setPassphrase("");
      vaultKey();
      announce("Vault unlocked", { kind: "action_completed", key: "vault" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("pw_token");
        window.location.assign("/login");
        return;
      }
      const msg = err instanceof Error ? err.message : "Unlock failed.";
      announce(`Unlock failed: ${msg}`, { kind: "error", key: "vault" });
    }
  }

  async function handleLock() {
    try {
      const res = await fetch(`${API_BASE}/api/vault/lock`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(
          res.status,
          "http_error",
          body?.detail ?? `Lock failed (${res.status}).`,
          { detail: body?.detail, body }
        );
      }
      vaultKey();
      announce("Vault locked", { kind: "action_completed", key: "vault" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("pw_token");
        window.location.assign("/login");
        return;
      }
      const msg = err instanceof Error ? err.message : "Lock failed.";
      announce(`Lock failed: ${msg}`, { kind: "error", key: "vault" });
    }
  }

  async function handleSetSecret(e: React.FormEvent) {
    e.preventDefault();
    const name = secretName.trim();
    const value = secretValue;
    if (!name || !value) return;
    try {
      await withStepUp(async () => {
        const res = await fetch(`${API_BASE}/api/vault/set`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ name, value }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const detail = body?.detail ?? `Store failed (${res.status}).`;
          if (res.status === 403 && /step-up/.test(detail)) {
            throw new ApiError(403, "step_up_required", detail, {
              detail,
              body,
            });
          }
          throw new ApiError(
            res.status,
            res.status === 403 ? "forbidden" : "http_error",
            detail,
            { detail, body }
          );
        }
        return res.json();
      });
      setSecretName("");
      setSecretValue("");
      vaultKey();
      names.refetch();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.code === "step_up_required"
      ) {
        return;
      }
      const msg = err instanceof Error ? err.message : "Store failed.";
      announce(`Store failed: ${msg}`, { kind: "error", key: "vault" });
    }
  }

  async function handleDelete(name: string) {
    try {
      await withStepUp(async () => {
        const res = await fetch(
          `${API_BASE}/api/vault/${encodeURIComponent(name)}`,
          { method: "DELETE", headers: authHeaders() }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const detail = body?.detail ?? `Delete failed (${res.status}).`;
          if (res.status === 403 && /step-up/.test(detail)) {
            throw new ApiError(403, "step_up_required", detail, {
              detail,
              body,
            });
          }
          throw new ApiError(
            res.status,
            res.status === 403 ? "forbidden" : "http_error",
            detail,
            { detail, body }
          );
        }
        return res.json();
      });
      setDeleteTarget(null);
      vaultKey();
      names.refetch();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.code === "step_up_required"
      ) {
        return;
      }
      const msg = err instanceof Error ? err.message : "Delete failed.";
      announce(`Delete failed: ${msg}`, { kind: "error", key: "vault" });
    }
  }

  return (
    <div className="pw-vault">
      <div className="pw-vault-ambient" aria-hidden="true" />

      <div className="pw-vault-top-decor" aria-hidden="true">
        <span className="pw-vault-sparkle pw-vault-sparkle--teal" />
        <span className="pw-vault-sparkle pw-vault-sparkle--rose" />
        <span className="pw-vault-sparkle pw-vault-sparkle--gold" />
      </div>

      <div className="pw-vault-lock-decor" aria-hidden="true">
        <span className="pw-vault-lock-decor-icon" />
      </div>

      <section className="pw-vault-header" aria-labelledby="vault-heading">
        <div className="pw-vault-lock-crest" aria-hidden="true">
          <span className="pw-vault-lock-icon" />
        </div>
        <div className="pw-vault-header-text">
          <h1 id="vault-heading" className="pw-vault-title">
            Vault
          </h1>
          <p className="pw-vault-subtitle">
            Your secrets, sealed on this machine. Names are shown; values never
            leave the vault.
          </p>
          <div className="pw-vault-lock-state" role="status">
            {locked ? (
              <StatusChip status="not_configured" />
            ) : (
              <>
                <span
                  className="pw-vault-lock-dot pw-vault-lock-dot--unlocked"
                  aria-hidden="true"
                />
                <span className="pw-vault-lock-label">Vault unlocked</span>
                <span className="pw-vault-lock-sparkle" aria-hidden="true">
                  &#10022;
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {vault.isError && vault.error ? (
        <section className="pw-vault-error-panel" aria-label="Vault error">
          <div className="pw-vault-error">
            <p className="pw-vault-error-message" role="alert">
              could not reach the vault
              {vault.error instanceof Error && vault.error.message
                ? `: ${vault.error.message}`
                : ""}
            </p>
            <p className="pw-vault-error-reassurance">
              The rest of your world still works.
            </p>
          </div>
        </section>
      ) : vault.isLoading ? (
        <section className="pw-vault-loading" aria-label="Vault loading">
          <p className="pw-vault-hint" role="status">
            Checking the vault&hellip;
          </p>
        </section>
      ) : locked ? (
        <section className="pw-vault-unlock-panel" aria-label="Vault unlock">
          <p className="pw-vault-hint">
            Unlock the vault to view your sealed secrets.
          </p>
          <form className="pw-vault-unlock-form" onSubmit={handleUnlock}>
            <label htmlFor="vault-passphrase" className="sr-only">
              Master passphrase
            </label>
            <input
              id="vault-passphrase"
              type="password"
              className="pw-vault-unlock-input"
              placeholder="Master passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="pw-vault-unlock-submit"
              disabled={!passphrase.trim()}
            >
              Unlock vault
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="pw-vault-columns">
            <section
              className="pw-vault-secrets"
              aria-labelledby="vault-secrets-heading"
            >
              <div className="pw-vault-secrets-header">
                <h2
                  id="vault-secrets-heading"
                  className="pw-vault-secrets-heading"
                >
                  Treasures in safekeeping
                </h2>
                <span className="pw-vault-secrets-count">
                  {secretNames.length} sealed{" "}
                  {secretNames.length === 1 ? "secret" : "secrets"}
                </span>
              </div>

              {names.isLoading ? (
                <p className="pw-vault-secrets-empty" role="status">
                  Loading secrets&hellip;
                </p>
              ) : secretNames.length === 0 ? (
                <p className="pw-vault-secrets-empty">
                  No secrets stored yet. Place something precious inside.
                </p>
              ) : (
                <ul className="pw-vault-secrets-list" role="list">
                  {secretNames.map((name) => (
                    <li key={name} className="pw-vault-secret-item">
                      <div className="pw-vault-secret-info">
                        <span className="pw-vault-secret-icon" aria-hidden="true" />
                        <div className="pw-vault-secret-text">
                          <span className="pw-vault-secret-name">{name}</span>
                          <span className="pw-vault-secret-meta">
                            value safely hidden
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="pw-vault-secret-remove"
                        onClick={() => setDeleteTarget(name)}
                        aria-label={`Delete secret ${name}`}
                      >
                        <span className="pw-vault-secret-remove-icon" aria-hidden="true" />
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pw-vault-secrets-footer">
                <p className="pw-vault-secrets-footer-text">
                  Finished for now? She&rsquo;ll keep watch from the other side.
                </p>
                <button
                  type="button"
                  className="pw-vault-lock-button"
                  onClick={handleLock}
                >
                  <span className="pw-vault-lock-button-icon" aria-hidden="true" />
                  Lock vault
                </button>
              </div>
            </section>

            <section
              className="pw-vault-store"
              aria-labelledby="vault-store-heading"
            >
              <div className="pw-vault-store-header">
                <h2
                  id="vault-store-heading"
                  className="pw-vault-store-heading"
                >
                  Place a secret inside
                </h2>
                <span className="pw-vault-store-icon" aria-hidden="true" />
              </div>
              <p className="pw-vault-store-subtitle">
                A small safe place for something precious.
              </p>

              <form className="pw-vault-store-form" onSubmit={handleSetSecret}>
                <div className="pw-vault-store-field">
                  <label
                    htmlFor="vault-secret-name"
                    className="pw-vault-store-label"
                  >
                    Secret name
                  </label>
                  <div className="pw-vault-store-input-wrap">
                    <span className="pw-vault-store-input-icon" aria-hidden="true" />
                    <input
                      id="vault-secret-name"
                      type="text"
                      className="pw-vault-store-input"
                      placeholder="Give it a name you will recognize"
                      value={secretName}
                      onChange={(e) => setSecretName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="pw-vault-store-field">
                  <label
                    htmlFor="vault-secret-value"
                    className="pw-vault-store-label"
                  >
                    Secret value
                  </label>
                  <div className="pw-vault-store-input-wrap">
                    <span className="pw-vault-store-input-icon" aria-hidden="true" />
                    <input
                      id="vault-secret-value"
                      type="password"
                      className="pw-vault-store-input"
                      placeholder="Paste it here — we won't peek"
                      value={secretValue}
                      onChange={(e) => setSecretValue(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <p className="pw-vault-store-note">
                  <span className="pw-vault-store-note-icon" aria-hidden="true" />
                  Encrypted locally. It stays on this machine, tucked safely out of sight.
                </p>
                <button
                  type="submit"
                  className="pw-vault-store-submit"
                  disabled={!secretName.trim() || !secretValue}
                >
                  <span className="pw-vault-store-submit-icon" aria-hidden="true" />
                  Store secret
                </button>
              </form>
            </section>
          </div>

          <footer className="pw-vault-footer" aria-hidden="true">
            <span className="pw-vault-footer-diamond">&#10022;</span>
            the sea keeps what it is told
            <span className="pw-vault-footer-diamond">&#10022;</span>
          </footer>

          <div className="pw-vault-companion" aria-hidden="true">
            <CompanionSlot size="empty" />
            <span className="pw-vault-companion-label">keeping watch</span>
          </div>

          <Dialog
            open={deleteTarget !== null}
            title="Delete this secret?"
            description={
              deleteTarget
                ? `Deleting "${deleteTarget}" removes it permanently from the vault.`
                : undefined
            }
            onCancel={() => setDeleteTarget(null)}
            onConfirm={
              deleteTarget ? () => void handleDelete(deleteTarget) : undefined
            }
            confirmLabel="Delete secret"
            danger
          />

          {stepUpPrompt}
        </>
      )}
    </div>
  );
}
