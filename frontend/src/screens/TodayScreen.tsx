import { useCallback, useState } from "react";
import {
  usePrincipal, useDaily, useJournal, useWorldStatus,
  useReminders, useSourceControlStatus, useAgentSyncProjects,
} from "../lib/hooks";
import { runDailyLoop } from "../lib/api";
import { summarizeCapabilities } from "../lib/capability-health";
import { projectToday } from "../lib/today-state";
import { useCompanion, COMPANIONS } from "../lib/companion-context";
import { Icon } from "../lib/icons";
import { StatusChip } from "../primitives/StatusChip";
import { Link } from "react-router-dom";
import "./today-screen.css";

/**
 * TodayScreen — the front room of Project Worlds.
 *
 * "Project Worlds is a warm, living personal environment that helps
 * me understand my life, discover things I care about, and feel
 * safely oriented in my world."
 *
 * Two dimensions:
 *   1. Does anything need me?
 *   2. Is there anything here for me?
 *
 * "Nothing needs you right now" is one of the best states
 * Project Worlds can have.
 *
 * Emotional priority:
 *   1. How the space makes me feel
 *   2. Helping me notice things I care about
 *   3. Helping me understand what is happening
 *   4. Helping me act when action is necessary
 *   5. Exposing technical machinery
 */

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

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
    try { await runDailyLoop(); setDailyResult("Done."); }
    catch { setDailyResult("Could not reach the server."); }
    finally { setDailyRunning(false); }
  }, []);

  const name = principal.data && !principal.isError
    ? String(principal.data.display_name || "").trim() || null : null;

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

  const projection = projectToday({
    health,
    repoAttention: reposNeedingAttention.map((r) => ({
      name: r.name,
      detail: r.error ? r.error : r.dirty ? "uncommitted changes"
        : r.ahead != null && r.ahead > 0 ? `${r.ahead} ahead`
        : r.behind != null && r.behind > 0 ? `${r.behind} behind` : "needs review",
    })),
    agentActivity: activeAgentProjects.map((p) => ({
      project: p.project, state: p.work_state, branch: p.branch ?? undefined,
    })),
    reminderCount: activeReminders.length,
    dailyLoaded: !!daily.data,
    dailyWarnings: daily.data?.warnings || [],
  });

  const isAttention = projection.composition === "attention";
  const totalAttention = health.attention.length + reposNeedingAttention.length;

  // The truth: what does Rylee need to know?
  const truth = isAttention
    ? projection.reason
    : totalAttention === 0
      ? "Nothing needs you right now."
      : totalAttention === 1
        ? "There is one thing worth looking at when you're ready."
        : `There are ${totalAttention} things worth looking at when you're ready.`;

  return (
    <div className="pw-today" data-pw-composition={projection.composition}>
      {/* ── The greeting ───────────────────────────────────────── */}
      <header className="pw-today-header">
        <div className="pw-today-header-text">
          <h1 className="pw-today-greeting">
            Good {getTimeOfDay()}{name ? `, ${name}` : ""}
            <span className="pw-today-sparkle" aria-hidden="true"> ✦</span>
          </h1>
          {/* Truth: integrated, not an alert banner */}
          <p className="pw-today-truth" role="status" aria-label="World state">
            {truth}
          </p>
        </div>
        {/* Companion: 96-120px, no glow, inhabits the surface */}
        <div className="pw-today-companion" aria-hidden="true">
          <div className="pw-today-companion-surface">
            <img src={companionIcon} alt="" className="pw-today-companion-img" />
          </div>
        </div>
      </header>

      {/* ── Stars: secondary decoration, aria-hidden ───────────── */}
      {health.configured > 0 && (
        <div className="pw-today-stars" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pw-today-star ${i < health.meter ? "pw-today-star--on" : ""}`} />
          ))}
          <span className="pw-today-stars-label">
            {health.healthy} of {health.configured} healthy
          </span>
        </div>
      )}

      {/* ── Summary: 2-3 meaningful things above the fold ──────── */}
      <section className="pw-today-summary" aria-label="World overview">
        {/* Project attention: one summary line */}
        {reposNeedingAttention.length > 0 && (
          <div className="pw-today-summary-item">
            <Icon name="icon-navigation-projects" size={16} className="pw-today-summary-icon" aria-hidden />
            <span>
              {reposNeedingAttention.length === 1
                ? "1 project may need attention."
                : `${reposNeedingAttention.length} projects may need attention.`}
            </span>
            <Link to="/projects" className="pw-today-summary-link">View</Link>
          </div>
        )}

        {/* Agent activity: quiet, not attention */}
        {activeAgentProjects.length > 0 && (
          <div className="pw-today-summary-item pw-today-summary-item--quiet">
            <Icon name="icon-chat-ai-agent" size={16} className="pw-today-summary-icon" aria-hidden />
            <span>
              {activeAgentProjects.length === 1
                ? `${activeAgentProjects[0].project} is active.`
                : `${activeAgentProjects.length} agents are working.`}
            </span>
          </div>
        )}

        {/* Reminders: quiet inline */}
        {activeReminders.length > 0 && (
          <div className="pw-today-summary-item pw-today-summary-item--quiet">
            <Icon name="icon-time-organization-clock" size={16} className="pw-today-summary-icon" aria-hidden />
            <span>
              {activeReminders.length === 1
                ? `1 reminder: "${activeReminders[0].text}"`
                : `${activeReminders.length} active reminders.`}
            </span>
          </div>
        )}

        {/* If nothing to summarize, show a quiet health line */}
        {reposNeedingAttention.length === 0 && activeAgentProjects.length === 0 && activeReminders.length === 0 && (
          <div className="pw-today-summary-item pw-today-summary-item--quiet">
            <Icon name="icon-world-content-world" size={16} className="pw-today-summary-icon" aria-hidden />
            <span>
              {health.unavailable.length > 0
                ? "Everything important is running. A few optional connections are offline."
                : "Everything is running normally."}
            </span>
          </div>
        )}
      </section>

      {/* ── Recent journal: 2-3 entries, truncated ─────────────── */}
      {journalEntries.length > 0 && (
        <section className="pw-today-journal" aria-label="Recent writing">
          <div className="pw-today-section-head">
            <h2 className="pw-today-section-title">Recent writing</h2>
            <Link to="/journal" className="pw-today-section-link">View all</Link>
          </div>
          <div className="pw-today-entries">
            {journalEntries.slice(0, 3).map((entry: any, i: number) => {
              const date = new Date(entry.ts);
              const label = date.toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric",
              });
              return (
                <article key={i} className="pw-today-entry">
                  <p className="pw-today-entry-text">{entry.text.slice(0, 140)}</p>
                  <time className="pw-today-entry-time" dateTime={entry.ts}>{label}</time>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Quick actions: restrained ───────────────────────────── */}
      <section className="pw-today-actions" aria-label="Quick actions">
        <Link to="/chat" className="pw-today-action-btn">
          <Icon name="icon-navigation-chat" size={16} aria-hidden />
          Ask your world
        </Link>
        <Link to="/journal" className="pw-today-action-btn">
          <Icon name="icon-navigation-journal" size={16} aria-hidden />
          Write
        </Link>
        <Link to="/projects" className="pw-today-action-btn">
          <Icon name="icon-navigation-projects" size={16} aria-hidden />
          Projects
        </Link>
      </section>

      {/* ── Attention items (only when real) ───────────────────── */}
      {isAttention && projection.items && projection.items.length > 0 && (
        <section className="pw-today-attention" aria-label="Needs attention">
          <h2 className="pw-today-section-title">Worth looking at</h2>
          <div className="pw-today-attention-list">
            {projection.items.map((item) => (
              <div key={item.id} className="pw-today-attention-row">
                <StatusChip status="needs_attention" size="sm" />
                <span className="pw-today-attention-text">{item.summary}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Daily loop: buried, almost invisible ───────────────── */}
      <footer className="pw-today-footer">
        <details className="pw-today-daily">
          <summary className="pw-today-daily-trigger">Advanced</summary>
          <div className="pw-today-daily-body">
            <button type="button" className="pw-today-daily-btn"
              onClick={runDaily} disabled={dailyRunning}>
              {dailyRunning ? "Running…" : "Run daily loop"}
            </button>
            {dailyResult && <p className="pw-today-daily-result">{dailyResult}</p>}
          </div>
        </details>
      </footer>
    </div>
  );
}
