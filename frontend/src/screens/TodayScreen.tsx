import { useCallback, useEffect, useState } from "react";
import {
  usePrincipal,
  useDaily,
  useJournal,
  useWorldStatus,
  useReminders,
  useSourceControlStatus,
  useAgentSyncProjects,
} from "../lib/hooks";
import { useShellModeOverride } from "../lib/shell-mode-context";
import { runDailyLoop } from "../lib/api";
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
  const { setScreenMode } = useShellModeOverride();

  const [dailyRunning, setDailyRunning] = useState(false);
  const [dailyResult, setDailyResult] = useState<string | null>(null);

  const runDaily = useCallback(async () => {
    setDailyRunning(true);
    setDailyResult(null);
    try {
      await runDailyLoop();
      setDailyResult("Daily loop complete.");
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
  const isBadDay = totalAttention > 0;

  // Question state (17:6245): companion has an observation — something
  // caught their attention but it's not a problem yet. Currently stubbed;
  // wire up when the companion observation API is available.
  const isQuestion = false; // TODO: companion observation state

  // Switch shell mode based on data state (Workshop v3):
  //   Quiet day (0 attention) → rail mode (17:481)
  //   Bad day (attention > 0) → sidebar mode (17:2117)
  //   Question (companion observation) → sidebar mode (17:6245)
  useEffect(() => {
    if (isBadDay || isQuestion) {
      setScreenMode("sidebar");
    } else {
      setScreenMode(null);
    }
    return () => setScreenMode(null);
  }, [isBadDay, isQuestion, setScreenMode]);

  if (isBadDay) {
    return (
      <div className="pw-today pw-today--bad-day">
        {/* Morning overview */}
        <section className="pw-today-overview" aria-labelledby="today-greeting">
          <div className="pw-today-greeting">
            <p className="pw-today-date">{dayName}, {monthDay}</p>
            <h1 id="today-greeting" className="pw-today-greeting-text">
              Good morning{name ? `, ${name}` : ""}.
            </h1>
            <p className="pw-today-summary">Some things need attention.</p>
          </div>
          <div className="pw-today-health" role="status" aria-label="World health">
            <p className="pw-today-health-label">World health</p>
            <div className="pw-today-health-stars" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`pw-today-health-star ${i < healthyCaps ? 'pw-today-health-star--active' : ''}`} />
              ))}
            </div>
            <p className="pw-today-health-detail">
              {healthyCaps} steady · {totalAttention} unavailable
            </p>
          </div>
        </section>

        {/* What needs you now */}
        <section className="pw-today-attention" aria-label="What needs you now">
          <h2 className="pw-today-section-title">What needs you now</h2>
          <div className="pw-today-attention-content">
            <div className="pw-today-attention-items">
              {reposNeedingAttention.map((repo) => (
                <div key={repo.name} className="pw-today-attention-item">
                  <span className="pw-today-attention-marker" aria-hidden="true" />
                  <div className="pw-today-attention-desc">
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
              {activeAgentProjects.map((p) => (
                <div key={p.project} className="pw-today-attention-item">
                  <span className="pw-today-attention-marker pw-today-attention-marker--agent" aria-hidden="true" />
                  <div className="pw-today-attention-desc">
                    <strong>{p.project}</strong>
                    {` — ${p.work_state}`}
                    {p.branch ? ` (${p.branch})` : ""}
                  </div>
                </div>
              ))}
              {attentionCaps > 0 && Object.entries(capabilities).filter(([, c]: [string, any]) => !c.ok).map(([name]) => (
                <div key={name} className="pw-today-attention-item">
                  <span className="pw-today-attention-marker pw-today-attention-marker--cap" aria-hidden="true" />
                  <div className="pw-today-attention-desc">
                    <strong>{name}</strong> — capability unavailable
                  </div>
                </div>
              ))}
            </div>
            <div className="pw-today-companion-note" aria-label="Companion note">
              <div className="pw-today-companion-portrait" aria-hidden="true">
                <span className="pw-today-companion-sparkle-note">✦</span>
              </div>
              <p className="pw-today-companion-quote">"I'll keep watching this."</p>
            </div>
          </div>
        </section>

        {/* Good to know — no action needed */}
        {(warnings.length > 0 || actions.length > 0) && (
          <section className="pw-today-info" aria-label="Good to know">
            <div className="pw-today-info-header">
              <h2 className="pw-today-section-title">Good to know — no action needed</h2>
              <span className="pw-today-info-status">Watching quietly</span>
            </div>
            <div className="pw-today-info-items">
              {warnings.map((warning: string, i: number) => (
                <div key={i} className="pw-today-info-item">{warning}</div>
              ))}
              {actions.map((action: string, i: number) => (
                <div key={i} className="pw-today-info-item">{action}</div>
              ))}
            </div>
          </section>
        )}

        {/* Waiting for help — paused capabilities */}
        {attentionCaps > 0 && (
          <section className="pw-today-waiting" aria-label="Waiting for help">
            <h2 className="pw-today-section-title">Waiting for help</h2>
            <div className="pw-today-waiting-content">
              {Object.entries(capabilities).filter(([, c]: [string, any]) => !c.ok).map(([name, cap]: [string, any]) => (
                <div key={name} className="pw-today-waiting-item">
                  <span className="pw-today-waiting-icon" aria-hidden="true" />
                  <div>
                    <strong>{name}</strong>
                    {cap.error ? ` — ${cap.error}` : " — paused"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Daily loop */}
        <section className="pw-today-recent" aria-label="Daily loop">
          <details className="pw-today-recent-card">
            <summary className="pw-today-recent-header" style={{ cursor: "pointer" }}>
              <span className="pw-today-recent-icon pw-today-recent-icon--changes" aria-hidden="true" />
              <h2 className="pw-today-recent-title" style={{ margin: 0 }}>Run Daily Loop</h2>
            </summary>
            <div className="pw-today-changes" style={{ padding: "8px 0" }}>
              <button type="button" className="pw-notification-action" onClick={runDaily} disabled={dailyRunning}>
                {dailyRunning ? "Running…" : "Run daily"}
              </button>
              {dailyResult && <p className="pw-today-peaceful-note" style={{ marginTop: 12 }}>{dailyResult}</p>}
            </div>
          </details>
        </section>
      </div>
    );
  }

  // Question state (17:6245): companion curiosity
  if (isQuestion) {
    return (
      <div className="pw-today pw-today--question">
        {/* Greeting */}
        <section className="pw-today-overview" aria-labelledby="today-greeting">
          <div className="pw-today-greeting">
            <h1 id="today-greeting" className="pw-today-greeting-text">
              Good morning{name ? `, ${name}` : ""}. <span aria-hidden="true">✦</span>
            </h1>
            <p className="pw-today-date">{dayName}, {monthDay}</p>
          </div>
          <div className="pw-today-health" role="status" aria-label="World health">
            <p className="pw-today-health-status">Your world is mostly quiet.</p>
            <div className="pw-today-health-stars" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`pw-today-health-star ${i < healthyCaps ? 'pw-today-health-star--active' : ''}`} />
              ))}
            </div>
          </div>
        </section>

        <div className="pw-today-wave-divider" aria-hidden="true" />

        {/* Question region — companion curiosity */}
        <section className="pw-today-question" aria-label="Something caught my attention">
          <div className="pw-today-question-companion" aria-hidden="true">
            <div className="pw-today-question-figure" />
            <span className="pw-today-question-sparkles">· ✦<br />✧</span>
          </div>
          <div className="pw-today-question-message">
            <div className="pw-today-question-accent" aria-hidden="true" />
            <div className="pw-today-question-content">
              <p className="pw-today-question-headline">Something caught my attention. <span aria-hidden="true">✦</span></p>
              <p className="pw-today-question-body">This isn't a problem yet — just something I noticed.</p>
              <p className="pw-today-question-body">I'll keep watching. It might resolve on its own.</p>
              <div className="pw-today-question-evidence">
                <p className="pw-today-question-evidence-label"><span aria-hidden="true">✦</span> What I can see:</p>
                <p className="pw-today-question-evidence-text">Observation details will appear here when the companion observation system is active.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="pw-today-wave-divider" aria-hidden="true" />

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
              ) : (
                <p className="pw-today-peaceful-note">The machinery is humming quietly beneath the surface.</p>
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
                journalEntries.slice(0, 2).map((entry: any, i: number) => {
                  const date = new Date(entry.ts);
                  const dayLabel = date.toLocaleDateString("en-US", { weekday: "long" });
                  return (
                    <div key={i} className="pw-today-entry">
                      <span className="pw-today-entry-sparkle" aria-hidden="true" />
                      <div className="pw-today-entry-copy">
                        <p className="pw-today-entry-title">{(entry.text || entry.summary || "").slice(0, 80)}</p>
                        <p className="pw-today-entry-time">{dayLabel}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="pw-today-peaceful-note">Your journal is quiet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

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

        {/* Notifications (17:6369) — "How the World Tells You Things" */}
        {(warnings.length > 0 || actions.length > 0) && (
          <div className="pw-today-notifications" role="region" aria-label="Notifications">
            {warnings.map((warning: string, i: number) => (
              <NotificationCard
                key={`w-${i}`}
                tone="small-update"
                headline={warning}
              />
            ))}
            {actions.map((action: string, i: number) => (
              <NotificationCard
                key={`a-${i}`}
                tone="action-required"
                headline={action}
                actionLabel="Review"
              />
            ))}
          </div>
        )}

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
                      <p className="pw-today-entry-title">{(entry.text || entry.summary || "").slice(0, 80)}</p>
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
