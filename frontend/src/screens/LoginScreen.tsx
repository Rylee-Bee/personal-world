import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchPrefs } from "../lib/api";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { Icon } from "../lib/icons";
import "./login-screen.css";

/**
 * LoginScreen (P1 T12, FOUNDATION-SPEC §1.5 + §7 row 9; Workshop v3
 * warmth pass 2026-09-13, frame 17:1681 "Project Worlds login",
 * GENEROUS register): the transitional token login. The token lives in
 * localStorage["pw_token"] (the legacy key, so existing browsers keep
 * working) until P2 replaces it with real sessions.
 *
 * Honest verification: the token is checked by fetching /api/prefs —
 * the same probe the legacy dashboard uses on load — so "Enter"
 * means "the server accepted this token", never "a value was stored".
 * A wrong token is reported as wrong; a reachable server is never
 * confused with a successful one.
 *
 * After a verified login the app navigates to / (SPA, no reload).
 * 401s anywhere else land here through the T6 setLoginNavigation hook
 * wired in App.tsx.
 *
 * The /setup link is the recovery path when no account has been
 * configured yet (fresh install deep-link parity, row 8) — the frame
 * renames it "Build your world →" (17:1723).
 *
 * Composition (frame 17:1681): the entrance column (title card +
 * portal card + footer) is the page's task order; the welcome
 * companion scene (17:1696–1703 — water halos + the Mermaid guide +
 * "I've been keeping the lanterns lit for you.") is decorative
 * presence beside it at ≥900px, a captioned presence row below the
 * portal on smaller screens. The frame's 220px Mermaid illustration
 * normalizes to the canonical rig via CompanionSlot (mermaid-art
 * reservation — presence scale recorded, not resolved; the guide is
 * design voice, not the user's selected companion, so the slot is
 * overridden to the canonical Mermaid identity). Background glow +
 * halo rings are token gradients; the frame's door line-art and
 * per-particle stars are design-agent art, rendered here as
 * aria-hidden Unicode ✦ marks only (decoration-encoding reservation).
 * Controls stay literal: the label is "Access code", the submit is
 * "Enter" (audit LITERAL), the link keeps its /setup href.
 */
function LoginScreen() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    const candidate = token.trim();
    if (!candidate || busy) return;
    setBusy(true);
    setError(null);
    // Store first so the API client sends it; a 401 clears it again
    // and routes back here — that IS the failed-login state.
    localStorage.setItem("pw_token", candidate);
    try {
      await fetchPrefs();
      navigate("/", { replace: true });
    } catch {
      // 401 already cleared pw_token via the api boundary; network
      // errors leave the candidate for correction either way.
      setError("That access code did not unlock your world. Check it and try again.");
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="login-heading" className="pw-login">
      <div className="pw-login-grid">
        {/* Entrance column (17:1704): title card + portal. */}
        <div className="pw-login-entrance">
          <div className="pw-login-title-card">
            <h1 id="login-heading" className="pw-login-title">
              Project Worlds
              <span aria-hidden="true" className="pw-login-title-spark">
                ✦
              </span>
            </h1>
            <p className="pw-login-waiting">Your world is waiting.</p>
          </div>
          <div className="pw-login-portal">
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void signIn();
              }}
            >
              <label htmlFor="pw-login-token">Access code</label>
              <div className="pw-login-field">
                <Icon
                  name="icon-system-device-lock"
                  size={17}
                  aria-hidden={true}
                  className="pw-login-field-icon"
                />
                <input
                  id="pw-login-token"
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={busy}
                />
              </div>
              <button type="submit" className="pw-login-submit" disabled={busy || !token.trim()}>
                {busy ? "Opening your world…" : "Enter"}
                {!busy ? (
                  <span aria-hidden="true" className="pw-login-submit-arrow">
                    →
                  </span>
                ) : null}
              </button>
              {error ? (
                <p className="pw-login-error" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
            <div className="pw-login-divider" aria-hidden="true">
              <span className="pw-login-divider-line" />
              <span className="pw-login-divider-star">✦</span>
              <span className="pw-login-divider-line" />
            </div>
            <p className="pw-login-alt">
              First time here?{" "}
              <Link to="/setup" className="pw-login-build">
                Build your world <span aria-hidden="true">→</span>
              </Link>
            </p>
          </div>
          <p className="pw-login-footer">A private place, made just for you.</p>
        </div>

        {/* Welcome companion (17:1696–1703): decorative presence —
            aria-hidden unit (artwork + the guide's caption speak as
            one decoration; the page works without it). */}
        <div aria-hidden="true" className="pw-login-companion">
          <div className="pw-login-halo">
            <div className="pw-login-halo-inner">
              <CompanionSlot size="empty" companion="mermaid" />
            </div>
          </div>
          <p className="pw-login-companion-line">I've been keeping the lanterns lit for you.</p>
        </div>
      </div>
    </section>
  );
}

export default LoginScreen;