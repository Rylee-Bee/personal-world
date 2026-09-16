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
import { runDailyLoop } from "../lib/api";
import { summarizeCapabilities } from "../lib/capability-health";
import { projectToday, type TodayItem } from "../lib/today-state";
import { useCompanion, COMPANIONS } from "../lib/companion-context";
import { Icon } from "../lib/icons";
import { StatusChip } from "../primitives/StatusChip";
import { Link } from "react-router-dom";
import "./today-screen.css";

/**
 * TodayScreen — §16.1 "Today — Quiet Day" (+ §16.2–16.6 states)
 *
 * Dashboard-calibrated: scannable cards, real data surfaces, status
 * at a glance. Calm and accessible, not a cold admin panel.
 *
 * Composition priority (§18):
 *   1. Genuine time-sensitive blocking matter → Attention
 *   2. Relevant actionable matter → Attention (lower volume)
 *   3. Material limitation → Reservation
 *   4. Question / good news when real
 *   5. Otherwise → Quiet
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

  const { companion } = useCompanion();
  const companionMeta = COMPANIONS[companion];
  const companionIcon = companionMeta?.icon || "/companions/personal-world.svg";

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
  const health = summarizeCapabilities(worldData?.capabilities);

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

  // §18: Project the Today composition from real evidence.
  const projection = projectToday({
    health,
    repoAttention: reposNeedingAttention.map((r) => ({
      name: r.name,
      detail: r.error
        ? r.error
        : r.dirty
          ? "uncommitted changes"
          : r.ahead != null && r.ahead > 0
            ? `${r.ahead} ahead`
            : r.behind != null && r.behind > 0
              ? `${r.behind} behind`
              : "needs review",
    })),
    agentActivity: activeAgentProjects.map((p) => ({
      project: p.project,
      state: p.work_state,
      branch: p.branch,
    })),
    reminderCount: activeReminders.length,
    dailyLoaded: !!daily.data,
    dailyWarnings: daily.data?.warnings || [],
  });

  const isQuiet = projection.composition === "quiet";
  const isAttention = projection.composition === "attention";

  return (
    <div className="pw-today" data-pw-composition={projection.composition}>
      {/* ── Header: greeting + world status ─────────────────────── */}
      <header className="pw-today-header">
        <div className="pw-today-header-left">
          <h1 id="today-greeting" className="pw-today-greeting">
            Good morning{name ? `, ${name}` : ""}{" "}
            <span aria-hidden="true" className="pw-today-greeting-mark">✦</span>
          </h1>
          <p className="pw-today-date">{dayName}, {monthDay}</p>
        </div>
        <div className="pw-today-header-right">
          <div className="pw-today-companion-art" aria-hidden="true">
            <img src={companionIcon} alt="" className="pw-today-companion-img" />
          </div>
        </div>
      </header>

      {/* ── Status banner (§18): the honest truth ──────────────── */}
      <section
        className={`pw-today-status ${isAttention ? "pw-today-status--attention" : isQuiet ? "pw-today-status--quiet" : ""}`}
        role="status"
        aria-label="World state"
      >
        <p className="pw-today-status-text">{projection.reason}</p>
      </section>

      {/* ── Capability health overview ──────────────────────────── */}
      <section className="pw-today-grid" aria-label="World overview">
        {/* Health summary card */}
        <div className="pw-today-card">
          <div className="pw-today-card-header">
            <Icon name="icon-world-content-world" size={18} className="pw-today-card-icon" aria-hidden />
            <h2 className="pw-today-card-title">World Health</h2>
          </div>
          <div className="pw-today-card-body">
            <div className="pw-today-health-stats">
              <div className="pw-today-health-stat">
                <span className="pw-today-health-number">{health.healthy}</span>
                <span className="pw-today-health-label">healthy</span>
              </div>
              {health.unavailable.length > 0 && (
                <div className="pw-today-health-stat pw-today-health-stat--dim">
                  <span className="pw-today-health-number">{health.unavailable.length}</span>
                  <span className="pw-today-health-label">unavailable</span>
                </div>
              )}
              <div className="pw-today-health-stat pw-today-health-stat--dim">
                <span className="pw-today-health-number">{health.optional}</span>
                <span className="pw-today-health-label">not set up</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reminders card — only when active */}
        {activeReminders.length > 0 && (
          <div className="pw-today-card">
            <div className="pw-today-card-header">
              <Icon name="icon-time-organization-clock" size={18} className="pw-today-card-icon" aria-hidden />
              <h2 className="pw-today-card-title">Reminders</h2>
              <span className="pw-today-card-count">{activeReminders.length}</span>
            </div>
            <div className="pw-today-card-body">
              <ul className="pw-today-card-list">
                {activeReminders.slice(0, 3).map((r) => (
                  <li key={r.id} className="pw-today-card-list-item">{r.text}</li>
                ))}
                {activeReminders.length > 3 && (
                  <li className="pw-today-card-list-more">
                    <Link to="/settings" className="pw-today-card-link">+{activeReminders.length - 3} more</Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Projects needing attention — only when real */}
        {reposNeedingAttention.length > 0 && (
          <div className="pw-today-card">
            <div className="pw-today-card-header">
              <Icon name="icon-navigation-projects" size={18} className="pw-today-card-icon" aria-hidden />
              <h2 className="pw-today-card-title">Projects</h2>
              <span className="pw-today-card-count">{reposNeedingAttention.length}</span>
            </div>
            <div className="pw-today-card-body">
              <ul className="pw-today-card-list">
                {reposNeedingAttention.map((repo) => (
                  <li key={repo.name} className="pw-today-card-list-item">
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
                  </li>
                ))}
              </ul>
              <Link to="/projects" className="pw-today-card-link">View all projects →</Link>
            </div>
          </div>
        )}

        {/* Agent activity — only when something is active */}
        {activeAgentProjects.length > 0 && (
          <div className="pw-today-card">
            <div className="pw-today-card-header">
              <Icon name="icon-chat-ai-agent" size={18} className="pw-today-card-icon" aria-hidden />
              <h2 className="pw-today-card-title">Agent Activity</h2>
            </div>
            <div className="pw-today-card-body">
              <ul className="pw-today-card-list">
                {activeAgentProjects.map((p) => (
                  <li key={p.project} className="pw-today-card-list-item">
                    <strong>{p.project}</strong>
                    {` — ${p.work_state}`}
                    {p.branch ? ` (${p.branch})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* ── Recent writing — only when entries exist ────────────── */}
      {journalEntries.length > 0 && (
        <section className="pw-today-section" aria-label="Recent writing">
          <div className="pw-today-section-header">
            <Icon name="icon-navigation-journal" size={18} className="pw-today-card-icon" aria-hidden />
            <h2 className="pw-today-section-title">Recent Writing</h2>
            <Link to="/journal" className="pw-today-card-link">View all →</Link>
          </div>
          <div className="pw-today-entries">
            {journalEntries.slice(0, 3).map((entry: any, i: number) => {
              const date = new Date(entry.ts);
              const dayLabel = date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <div key={i} className="pw-today-entry">
                  <p className="pw-today-entry-text">{entry.text.slice(0, 140)}</p>
                  <p className="pw-today-entry-time">{dayLabel}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Attention items (§16.4) — when present ─────────────── */}
      {isAttention && projection.items && projection.items.length > 0 && (
        <section className="pw-today-section" aria-label="Needs attention">
          <h2 className="pw-today-section-title">Needs Attention</h2>
          <div className="pw-today-attention-list">
            {projection.items.map((item: TodayItem) => (
              <div key={item.id} className="pw-today-attention-item">
                <StatusChip status="needs_attention" />
                <span className="pw-today-attention-summary">{item.summary}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Reservation items (§16.3) — when present ───────────── */}
      {!isAttention && projection.items && projection.items.length > 0 && (
        <section className="pw-today-section" aria-label="Unavailable">
          <h2 className="pw-today-section-title">Currently Unavailable</h2>
          <div className="pw-today-attention-list">
            {projection.items.map((item: TodayItem) => (
              <div key={item.id} className="pw-today-attention-item">
                <StatusChip status="unavailable" />
                <span className="pw-today-attention-summary">{item.summary}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Daily loop trigger — muted, accessible ─────────────── */}
      <section className="pw-today-section pw-today-section--muted" aria-label="Daily loop">
        <details>
          <summary className="pw-today-section-title pw-today-section-title--summary">
            Run Daily Loop
          </summary>
          <div className="pw-today-daily">
            <p className="pw-today-daily-desc">
              Triggers the daily digest — observations, enrichment, and journal entries.
            </p>
            <button
              type="button"
              className="pw-today-daily-btn"
              onClick={runDaily}
              disabled={dailyRunning}
            >
              {dailyRunning ? "Running…" : "Run daily"}
            </button>
            {dailyResult && (
              <p className="pw-today-daily-result">{dailyResult}</p>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
