import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchSetupStatus,
  postSetup,
  savePrefs,
  saveWorldFact,
  getAuthToken,
  ApiError,
} from "../lib/api";
import { COMPANIONS } from "../lib/companion-context";
import { Button } from "../components/ui/button";
import { Check, Sparkles, GitBranch, Calendar, BookOpen, Globe } from "../lib/icons";
import "./setup-wizard.css";

const WORLD_NAME_FACT_KEY = "world.name";
const DEFAULT_WORLD_NAME = "My Project Worlds";
const COMPANION_IDS = Object.keys(COMPANIONS);

const COMPANION_CHOICES = COMPANION_IDS.map((id) => ({
  id,
  name: COMPANIONS[id].name,
  icon: COMPANIONS[id].icon,
}));

const CAPABILITIES = [
  { id: "source-control", name: "Source Control", Icon: GitBranch },
  { id: "calendar", name: "Calendar", Icon: Calendar },
  { id: "notes", name: "Notes", Icon: BookOpen },
  { id: "weather", name: "Weather", Icon: Globe },
];

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.";
  const max = Math.floor(0x100000000 / chars.length) * chars.length;
  let result = "";
  while (result.length < 32) {
    const values = crypto.getRandomValues(new Uint32Array(32));
    for (let i = 0; i < values.length && result.length < 32; i++) {
      if (values[i] < max) result += chars.charAt(values[i] % chars.length);
    }
  }
  return result;
}

type Completion = {
  tokenSet: boolean;
  vaultInitialized: boolean;
  nameSaved: boolean;
  companionSaved: boolean;
};

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [companion, setCompanion] = useState("personal-world");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [vaultPass, setVaultPass] = useState("");
  const [vaultPass2, setVaultPass2] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);

  useEffect(() => {
    fetchSetupStatus()
      .then((d) => {
        if (d && typeof d === "object" && "complete" in d) {
          setAlreadySetup(Boolean((d as { complete: unknown }).complete));
        }
      })
      .catch(() => {});
  }, []);

  const selectedCompanion = COMPANION_CHOICES.find((c) => c.id === companion);

  const handleFinish = async () => {
    setIsSaving(true);
    setError(null);
    const worldName = name.trim() || DEFAULT_WORLD_NAME;
    const result: Completion = {
      tokenSet: false,
      vaultInitialized: false,
      nameSaved: false,
      companionSaved: false,
    };
    try {
      const setup = await postSetup({
        token,
        companion,
        ...(vaultPass ? { vault_passphrase: vaultPass } : {}),
      });
      result.tokenSet = setup.token_set !== false;
      result.vaultInitialized = Boolean(setup.vault_initialized);
    } catch (e) {
      setError(
        e instanceof ApiError && e.detail
          ? `Setup failed: ${e.detail}`
          : "Setup failed. Check the server and try again."
      );
      setIsSaving(false);
      return;
    }
    localStorage.setItem("pw_token", token);
    try {
      await savePrefs({
        motion: "reduced",
        contrast: "comfortable",
        text_scale: 1,
        density: "comfortable",
        target_size: 44,
        companion,
        accent: "world-keeper",
      });
      result.companionSaved = true;
    } catch {
      // Companion pref is cosmetic; never blocks setup.
    }
    try {
      await saveWorldFact(WORLD_NAME_FACT_KEY, worldName);
      result.nameSaved = true;
    } catch {
      // Name can be set again later; the world still works.
    }
    setCompletion(result);
    setIsSaving(false);
    setStep(4);
  };

  if (alreadySetup) {
    return (
      <section aria-labelledby="setup-done-heading" className="pw-setup">
        <div className="pw-setup-card">
          <h1 id="setup-done-heading">Your Project Worlds is already set up</h1>
          <p>
            This world has been configured before. Open it with your access
            code on the sign-in page.
          </p>
          <Button onClick={() => navigate("/login")}>Go to sign in</Button>
        </div>
      </section>
    );
  }

  const canFinish = token.length >= 8 && (!vaultPass || vaultPass === vaultPass2);

  return (
    <section aria-labelledby="setup-heading" className="pw-setup">
      <div className="pw-setup-layout">
        {/* ── Left: Companion greeting ── */}
        <div className="pw-setup-greeting">
          <div className="pw-setup-greeting-art">
            <img src="/companions/personal-world.svg" alt="" aria-hidden="true" className="pw-setup-greeting-img" />
          </div>
          <div className="pw-setup-greeting-text">
            <p className="pw-setup-greeting-label">A new companion arrives</p>
            <p className="pw-setup-greeting-quote">
              "I'm glad you're here. Shall we make this place yours?"
            </p>
          </div>
        </div>

        {/* ── Right: Setup card ── */}
        <div className="pw-setup-card">
          <div className="pw-setup-welcome">
            <p className="pw-setup-eyebrow">Project Worlds · First light</p>
            <h1 id="setup-heading">Welcome to your World.</h1>
            <p className="pw-setup-subtitle">
              Everything here belongs to you. We're just getting started.
            </p>
          </div>

          <p className="pw-setup-step-label" aria-live="polite">
            Step {step} of 4
          </p>

          {/* ── Step 1: First encounter ── */}
          {step === 1 && (
            <div className="pw-setup-step">
              {/* World name */}
              <div className="pw-setup-section">
                <label htmlFor="setup-name">World name</label>
                <p className="pw-setup-hint">
                  A friendly name you can change later. Leave it blank and we'll
                  use "{DEFAULT_WORLD_NAME}".
                </p>
                <input
                  id="setup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={DEFAULT_WORLD_NAME}
                  maxLength={60}
                />
              </div>

              {/* Capability invitation */}
              <div className="pw-setup-section">
                <div className="pw-setup-section-header">
                  <p className="pw-setup-question">What should your World watch?</p>
                  <p className="pw-setup-guidance">Choose as many as you like.</p>
                </div>
                <div className="pw-setup-capabilities">
                  {CAPABILITIES.map((cap) => (
                    <button
                      key={cap.id}
                      type="button"
                      className="pw-setup-cap-tile"
                      aria-label={cap.name}
                    >
                      <cap.Icon size={32} aria-hidden={true} />
                      <span>{cap.name}</span>
                    </button>
                  ))}
                </div>
                <p className="pw-setup-hint">You can always add more later.</p>
              </div>

              {/* Companion invitation */}
              <div className="pw-setup-section">
                <div className="pw-setup-section-header">
                  <p className="pw-setup-question">Choose a companion</p>
                  <p className="pw-setup-guidance">A friend to keep watch.</p>
                </div>
                <div className="pw-setup-companions" role="radiogroup" aria-label="Companion">
                  {COMPANION_CHOICES.map((c) => {
                    const isSelected = companion === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setCompanion(c.id)}
                        className={`pw-setup-comp-btn${isSelected ? " selected" : ""}`}
                      >
                        <div className="pw-setup-comp-portrait">
                          <img src={c.icon} alt="" aria-hidden="true" />
                        </div>
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="pw-setup-hint">
                  Your companion keeps watch over your world. You can change
                  this anytime in Settings.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Token ── */}
          {step === 2 && (
            <div className="pw-setup-step">
              <p className="pw-setup-question">Choose your login token.</p>
              <p className="pw-setup-hint">
                This is the access code for your world — at least 8 characters.
                Generate a strong one and save it somewhere safe, like a
                password manager. It is shown once here.
              </p>
              <label htmlFor="setup-token">Login token</label>
              <input
                id="setup-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="new-password"
              />
              <div className="pw-setup-token-actions">
                <Button variant="outline" onClick={() => setToken(generateToken())}>
                  <Sparkles aria-hidden={true} /> Generate strong token
                </Button>
                <Button variant="outline" onClick={() => setShowToken(!showToken)}>
                  {showToken ? "Hide" : "Show"}
                </Button>
              </div>
              {token && token.length < 8 ? (
                <p className="pw-setup-warning" role="alert">
                  At least 8 characters, or press Generate.
                </p>
              ) : null}
            </div>
          )}

          {/* ── Step 3: Vault + Summary ── */}
          {step === 3 && (
            <div className="pw-setup-step">
              <p className="pw-setup-question">Optional: vault passphrase.</p>
              <p className="pw-setup-hint">
                The vault keeps secrets encrypted. A passphrase here works like
                a second key — you'd use it every time you open the vault.
                Totally fine to skip this now and add it later in Settings.
              </p>
              <label htmlFor="setup-vault1">Vault passphrase (optional)</label>
              <input
                id="setup-vault1"
                type="password"
                value={vaultPass}
                onChange={(e) => setVaultPass(e.target.value)}
                autoComplete="new-password"
              />
              <label htmlFor="setup-vault2">Confirm</label>
              <input
                id="setup-vault2"
                type="password"
                value={vaultPass2}
                onChange={(e) => setVaultPass2(e.target.value)}
                autoComplete="new-password"
              />
              {vaultPass && vaultPass2 && vaultPass !== vaultPass2 ? (
                <p className="pw-setup-warning" role="alert">
                  Passphrases do not match.
                </p>
              ) : null}
              <div className="pw-setup-summary" aria-label="Setup summary">
                <div className="pw-setup-summary-row">
                  <span>World name</span>
                  <span>{name.trim() || DEFAULT_WORLD_NAME}</span>
                </div>
                <div className="pw-setup-summary-row">
                  <span>Companion</span>
                  <span>{selectedCompanion?.name ?? companion}</span>
                </div>
                <div className="pw-setup-summary-row">
                  <span>Login token</span>
                  <span>{token ? `${token.length} characters` : "None set"}</span>
                </div>
                <div className="pw-setup-summary-row">
                  <span>Vault passphrase</span>
                  <span>{vaultPass ? "set" : "skipped for now"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Success ── */}
          {step === 4 && completion && (
            <div className="pw-setup-step pw-setup-done">
              <Check aria-hidden={true} />
              <p>Your world is ready. Opening sign-in…</p>
              <ul className="pw-setup-completion">
                <li>{completion.tokenSet ? "Access code set" : "Access code NOT set"}</li>
                <li>
                  {completion.vaultInitialized
                    ? "Vault initialized with your passphrase"
                    : "Vault left locked for later"}
                </li>
                <li>
                  {completion.nameSaved
                    ? "World name saved"
                    : "World name could not be saved — set it again in Settings"}
                </li>
                <li>
                  {completion.companionSaved
                    ? "Companion saved"
                    : "Companion will use the default for now"}
                </li>
              </ul>
              <Button
                onClick={() => {
                  if (getAuthToken()) navigate("/", { replace: true });
                  else navigate("/login");
                }}
              >
                Open your world
              </Button>
            </div>
          )}

          {error ? (
            <p className="pw-setup-error" role="alert">
              {error}
            </p>
          ) : null}

          {/* ── Actions ── */}
          {step < 4 && (
            <div className="pw-setup-actions">
              {step === 1 && (
                <button
                  type="button"
                  className="pw-setup-skip"
                  onClick={() => {
                    setCompanion("personal-world");
                    void handleFinish();
                  }}
                >
                  Or skip for now — you can set up everything later.
                </button>
              )}
              <div className="pw-setup-nav">
                {step > 1 ? (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                {step < 3 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={step === 2 && token.length < 8}
                  >
                    Next
                  </Button>
                ) : (
                  <Button onClick={() => void handleFinish()} disabled={!canFinish || isSaving}>
                    {isSaving ? "Setting up your world…" : "Finish setup"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default SetupWizard;
