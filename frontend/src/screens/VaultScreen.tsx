import { useVaultStatus } from "../lib/hooks";
import "./vault-screen.css";

export default function VaultScreen() {
  const vault = useVaultStatus();
  const vaultData = vault.data;
  const locked = vaultData?.locked ?? true;

  return (
    <div className="pw-vault">
      <div className="pw-vault-ambient" aria-hidden="true" />

      <section className="pw-vault-header" aria-labelledby="vault-heading">
        <div className="pw-vault-lock-crest" aria-hidden="true">
          <span className="pw-vault-lock-icon" />
        </div>
        <h1 id="vault-heading" className="pw-vault-title">Vault</h1>
        <p className="pw-vault-subtitle">
          {locked ? "Treasures in safekeeping" : "Vault is open"}
        </p>
      </section>

      <section className="pw-vault-body" aria-label="Vault contents">
        <div className="pw-vault-lock-state" role="status">
          <span className={`pw-vault-lock-dot ${locked ? "" : "pw-vault-lock-dot--unlocked"}`} aria-hidden="true" />
          <span className="pw-vault-lock-label">
            {locked ? "Locked" : "Unlocked"}
          </span>
        </div>
        <p className="pw-vault-hint">
          {locked
            ? "Unlock the vault to view your sealed secrets."
            : "Your vault is open. Secrets are accessible."}
        </p>
      </section>
    </div>
  );
}
