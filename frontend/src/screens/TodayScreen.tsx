import { usePrincipal, useDaily, useJournal, useWorldStatus } from "../lib/hooks";
import "./today-screen.css";

/**
 * NotificationCard — Workshop v3, frame 17:6369
 * "How the World Tells You Things"
 *
 * Stub for now — will be built from Figma evidence.
 */
export interface NotificationCardProps {
  tone: "good-news" | "small-update" | "action-required";
  headline: string;
  detail?: string;
  actionLabel?: string;
  onDismiss?: () => void;
  onAction?: () => void;
}

export function NotificationCard({ tone, headline, detail, actionLabel, onDismiss, onAction }: NotificationCardProps) {
  return (
    <div className={`pw-notification pw-notification--${tone}`} role="status">
      <div className="pw-notification-content">
        <p className="pw-notification-headline">{headline}</p>
        {detail && <p className="pw-notification-detail">{detail}</p>}
      </div>
      <div className="pw-notification-actions">
        {actionLabel && (
          <button type="button" className="pw-notification-action" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button type="button" className="pw-notification-dismiss" onClick={onDismiss} aria-label="Dismiss">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * TodayScreen — Workshop v3, frame 17:481 "Today — Quiet Day"
 *
 * Built from canonical Figma evidence. AMBIENT register.
 * Shell mode: rail (112px)
 *
 * "Nothing needs you right now. Your world is running on its own."
 */

export default function TodayScreen() {
  const principal = usePrincipal();
  const daily = useDaily();
  const journal = useJournal();
  const worldStatus = useWorldStatus();

  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  // Get world status
  const worldData = worldStatus.data;
  const capabilities = worldData?.capabilities || {};
  const healthyCaps = Object.values(capabilities).filter((c: any) => c.ok).length;
  const attentionCaps = Object.values(capabilities).filter((c: any) => !c.ok).length;

  // Get daily data
  const dailyData = daily.data;
  const warnings = dailyData?.warnings || [];
  const actions = dailyData?.actions || [];

  // Get journal entries
  const journalEntries = journal.data || [];

  return (
    <div className="pw-today">
      {/* World welcome */}
      <section className="pw-today-welcome" aria-labelledby="today-greeting">
        {/* Greeting and health */}
        <div className="pw-today-greeting-row">
          <div className="pw-today-greeting">
            <h1 id="today-greeting" className="pw-today-greeting-text">
              Good morning{name ? `, ${name}` : ""}. <span aria-hidden="true">✦</span>
            </h1>
            <p className="pw-today-date">
              {dayName}, {monthDay}
            </p>
          </div>

          <div className="pw-today-health" role="status" aria-label="World health">
            <div className="pw-today-health-stars" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`pw-today-health-star ${i < healthyCaps ? 'pw-today-health-star--active' : ''}`} />
              ))}
            </div>
            <p className="pw-today-health-status">
              {attentionCaps === 0
                ? "Your world is running well."
                : `${attentionCaps} capability needs attention.`}
            </p>
            <p className="pw-today-health-detail">
              {healthyCaps} connected capabilities healthy · {attentionCaps} attention
            </p>
          </div>
        </div>

        {/* Companion message */}
        <div className="pw-today-companion-message" aria-label="Companion message">
          <div className="pw-today-companion-art" aria-hidden="true">
            {/* Mermaid presence — decorative artwork */}
            <div className="pw-today-companion-figure" />
            <span className="pw-today-companion-bubble" />
            <span className="pw-today-companion-bubble pw-today-companion-bubble--small" />
            <span className="pw-today-companion-sparkle" />
          </div>
          <div className="pw-today-companion-copy">
            <p className="pw-today-companion-title">
              {attentionCaps === 0
                ? "Nothing needs you right now."
                : `${attentionCaps} thing${attentionCaps === 1 ? '' : 's'} need${attentionCaps === 1 ? 's' : ''} your attention.`}
            </p>
            <p className="pw-today-companion-body">
              {attentionCaps === 0
                ? "Your world is running on its own. You can check on things below, or just enjoy the quiet."
                : "Review the items below to keep your world running smoothly."}
            </p>
          </div>
          <div className="pw-today-companion-arrow" aria-hidden="true" />
        </div>

        {/* Waves-ladder divider */}
        <div className="pw-today-divider" aria-hidden="true" />
      </section>

      {/* Recent activity */}
      <section className="pw-today-recent" aria-label="Recent activity">
        <div className="pw-today-recent-card">
          <div className="pw-today-recent-header">
            <span className="pw-today-recent-icon pw-today-recent-icon--changes" aria-hidden="true" />
            <h2 className="pw-today-recent-title">Recent Changes</h2>
          </div>
          <div className="pw-today-changes">
            {warnings.length > 0 ? (
              <ul className="pw-today-warnings">
                {warnings.map((warning: string, i: number) => (
                  <li key={i} className="pw-today-warning">{warning}</li>
                ))}
              </ul>
            ) : actions.length > 0 ? (
              <ul className="pw-today-actions">
                {actions.map((action: string, i: number) => (
                  <li key={i} className="pw-today-action">{action}</li>
                ))}
              </ul>
            ) : (
              <p className="pw-today-peaceful-note">
                The machinery is humming quietly beneath the surface.
              </p>
            )}
          </div>
        </div>

        <div className="pw-today-recent-card">
          <div className="pw-today-recent-header">
            <span className="pw-today-recent-icon pw-today-recent-icon--journal" aria-hidden="true" />
            <h2 className="pw-today-recent-title">Recent Journal</h2>
          </div>
          <div className="pw-today-entries">
            {journalEntries.length > 0 ? (
              journalEntries.map((entry: any, i: number) => {
                const date = new Date(entry.ts);
                const dayLabel = date.toLocaleDateString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" });
                return (
                  <div key={i} className="pw-today-entry">
                    <span className="pw-today-entry-sparkle" aria-hidden="true" />
                    <div className="pw-today-entry-copy">
                      <p className="pw-today-entry-title">{entry.text.slice(0, 80)}</p>
                      <p className="pw-today-entry-time">{dayLabel}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="pw-today-peaceful-note">
                Your journal is quiet. Write when you're ready.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
