import { useCallback, useState } from "react";
import {
  usePrincipal,
  useDaily,
  useJournal,
  useWorldStatus,
  useReminders,
  useSourceControlStatus,
  useAgentSyncProjects,
} from "../lib/hooks";
import { getAuthToken } from "../lib/api";
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
  const reminders = useReminders();
  const sourceControl = useSourceControlStatus();
  const agentSync = useAgentSyncProjects();

  const [dailyRunning, setDailyRunning] = useState(false);
  const [dailyResult, setDailyResult] = useState<string | null>(null);

  const runDaily = useCallback(async () => {
    setDailyRunning(true);
    setDailyResult(null);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
          "X-PW-StepUp": "1",
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDailyResult(body?.detail || `Failed (${res.status})`);
      } else {
        setDailyResult("Daily loop complete.");
      }
    } catch {
      setDailyResult("Could not reach the server.");
    } finally {
      setDailyRunning(false);
    }
  }, []);

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

  const worldData = worldStatus.data;
  const capabilities = worldData?.capabilities || {};
  const healthyCaps = Object.values(capabilities).filter((c: any) => c.ok).length;
  const attentionCaps = Object.values(capabilities).filter((c: any) => !c.ok).length;

  const dailyData = daily.data;
  const warnings = dailyData?.warnings || [];
  const actions = dailyData?.actions || [];

  const journalEntries = journal.data || [];

  const activeReminders = (reminders.data || []).filter((r) => r.enabled);

  const scRepos = sourceControl.data?.data?.repos || [];
  const reposNeedingAttention = scRepos.filter(
    (r) => r.error || (r.dirty ?? false) || (r.ahead != null && r.ahead > 0) || (r.behind != null && r.behind > 0)
  );

  const agentProjects = agentSync.data?.data?.projects || [];
  const activeAgentProjects = agentProjects.filter(
    (p) => p.work_state !== "idle" && p.work_state !== "unknown"
  );

  const totalAttention = attentionCaps + reposNeedingAttention.length + activeAgentProjects.length;

  return (
    <div className="pw-today">
      {/* World welcome */}
      <section className="pw-today-welcome" aria-labelledby="today-greeting">
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
              {totalAttention === 0
                ? "Your world is running well."
                : `${totalAttention} thing${totalAttention === 1 ? '' : 's'} need${totalAttention === 1 ? 's' : ''} attention.`}
            </p>
            <p className="pw-today-health-detail">
              {healthyCaps} capabilities healthy · {reposNeedingAttention.length} repos attention · {activeAgentProjects.length} agent active
            </p>
          </div>
        </div>

        {/* Companion message */}
        <div className="pw-today-companion-message" aria-label="Companion message">
          <div className="pw-today-companion-art" aria-hidden="true">
            <div className="pw-today-companion-figure" />
            <span className="pw-today-companion-bubble" />
            <span className="pw-today-companion-bubble pw-today-companion-bubble--small" />
            <span className="pw-today-companion-sparkle" />
          </div>
          <div className="pw-today-companion-copy">
            <p className="pw-today-companion-title">
              {totalAttention === 0
                ? "Nothing needs you right now."
                : `${totalAttention} thing${totalAttention === 1 ? '' : 's'} need${totalAttention === 1 ? 's' : ''} your attention.`}
            </p>
            <p className="pw-today-companion-body">
              {totalAttention === 0
                ? "Your world is running on its own. You can check on things below, or just enjoy the quiet."
                : "Review the items below to keep your world running smoothly."}
            </p>
          </div>
          <div className="pw-today-companion-arrow" aria-hidden="true" />
        </div>

        <div className="pw-today-divider" aria-hidden="true" />
      </section>

      {/* Active reminders */}
      {activeReminders.length > 0 && (
        <section className="pw-today-recent" aria-label="Active reminders">
          <div className="pw-today-recent-card" style={{ flex: 1 }}>
            <div className="pw-today-recent-header">
              <span className="pw-today-recent-icon pw-today-recent-icon--changes" aria-hidden="true" />
              <h2 className="pw-today-recent-title">Active Reminders</h2>
            </div>
            <ul className="pw-today-warnings">
              {activeReminders.map((r) => (
                <li key={r.id} className="pw-today-warning">{r.text}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Project attention */}
      {reposNeedingAttention.length > 0 && (
        <section className="pw-today-recent" aria-label="Project attention">
          <div className="pw-today-recent-card" style={{ flex: 1 }}>
            <div className="pw-today-recent-header">
              <span className="pw-today-recent-icon pw-today-recent-icon--changes" aria-hidden="true" />
              <h2 className="pw-today-recent-title">Projects Need Attention</h2>
            </div>
            <div className="pw-today-changes">
              {reposNeedingAttention.map((repo) => (
                <div key={repo.name} className="pw-today-change">
                  <span className="pw-today-change-marker" aria-hidden="true" />
                  <div className="pw-today-change-desc">
                    <strong>{repo.name}</strong>
                    {repo.error
                      ? ` — ${repo.error}`
                      : repo.dirty
                        ? " — uncommitted changes"
                        : repo.ahead != null && repo.ahead > 0
                          ? ` — ${repo.ahead} ahead`
                          : repo.behind != null && repo.behind > 0
                            ? ` — ${repo.behind} behind`
                            : ""}
                    {repo.branch ? ` (${repo.branch})` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Agent work state */}
      {activeAgentProjects.length > 0 && (
        <section className="pw-today-recent" aria-label="Agent activity">
          <div className="pw-today-recent-card" style={{ flex: 1 }}>
            <div className="pw-today-recent-header">
              <span className="pw-today-recent-icon pw-today-recent-icon--journal" aria-hidden="true" />
              <h2 className="pw-today-recent-title">Agent Activity</h2>
            </div>
            <div className="pw-today-changes">
              {activeAgentProjects.map((p) => (
                <div key={p.project} className="pw-today-change">
                  <span className="pw-today-change-marker" aria-hidden="true" />
                  <div className="pw-today-change-desc">
                    <strong>{p.project}</strong>
                    {` — ${p.work_state}`}
                    {p.branch ? ` (${p.branch})` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

      {/* Run daily */}
      <section className="pw-today-recent" aria-label="Daily loop">
        <details className="pw-today-recent-card">
          <summary className="pw-today-recent-header" style={{ cursor: "pointer" }}>
            <span className="pw-today-recent-icon pw-today-recent-icon--changes" aria-hidden="true" />
            <h2 className="pw-today-recent-title" style={{ margin: 0 }}>Run Daily Loop</h2>
          </summary>
          <div className="pw-today-changes" style={{ padding: "8px 0" }}>
            <p className="pw-today-peaceful-note" style={{ marginBottom: 12 }}>
              Triggers the daily digest — observations, enrichment, and journal entries.
            </p>
            <button
              type="button"
              className="pw-notification-action"
              onClick={runDaily}
              disabled={dailyRunning}
            >
              {dailyRunning ? "Running…" : "Run daily"}
            </button>
            {dailyResult && (
              <p className="pw-today-peaceful-note" style={{ marginTop: 12 }}>
                {dailyResult}
              </p>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
