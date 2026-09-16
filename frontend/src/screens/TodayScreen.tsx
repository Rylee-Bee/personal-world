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
import { projectToday } from "../lib/today-state";
import { useCompanion, COMPANIONS } from "../lib/companion-context";
import { Icon } from "../lib/icons";
import { StatusChip } from "../primitives/StatusChip";
import { Link } from "react-router-dom";
import "./today-screen.css";

/**
 * TodayScreen — "Calm Linear living inside a warm personal world."
 *
 * The morning screen. Primary question: "Does anything need me?"
 *
 * Composition: Ambient register. Scannable cards with real data.
 * Silence is valid content. The companion is a small meaningful
 * presence. Health stars are secondary decoration.
 *
 * §37: "I open Project Worlds and can immediately tell: How is my
 * world? Does anything need me? What changed? What can I do next?"
 *
 * §39: "Good morning, Rylee. Nothing needs you right now."
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

  // §18: Project composition from real evidence.
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
      branch: p.branch ?? undefined,
    })),
    reminderCount: activeReminders.length,
    dailyLoaded: !!daily.data,
    dailyWarnings: daily.data?.warnings || [],
  });

  const isQuiet = projection.composition === "quiet";
  const isAttention = projection.composition === "attention";

  // Count total things that might need attention.
  const totalAttention = health.attention.length + reposNeedingAttention.length;
  // Differentiate normal active work from something actually going wrong.
  // Agent activity is "active work" — calm, not attention.
  const hasAgentActivity = activeAgentProjects.length > 0;

  return (
    <div className="pw-today" data-pw-composition={projection.composition}>
      {/* ── Header: greeting + companion presence ───────────────── */}
      <header className="pw-today-header">
        <div className="pw-today-header-left">
          <h1 id="today-greeting" className="pw-today-greeting">
            Good morning{name ? `, ${name}` : ""}
            <span aria-hidden="true" className="pw-today-greeting-mark"> ✦</span>
          </h1>
          <p className="pw-today-date">{dayName}, {monthDay}</p>
        </div>
        <div className="pw-today-header-right" aria-hidden="true">
          <div className="pw-today-companion-art">
            <img src={companionIcon} alt="" className="pw-today-companion-img" />
          </div>
        </div>
      </header>

      {/* ── Truth sentence (§39): "caught up, not behind" ────────── */}
      <section className="pw-today-truth" role="status" aria-label="World state">
        <p className="pw-today-truth-text">
          {isQuiet
            ? totalAttention === 0
              ? "Nothing needs you right now."
              : totalAttention === 1
                ? "There is one thing worth looking at when you're ready."
                : `There are ${totalAttention} things worth looking at when you're ready.`
            : isAttention
              ? projection.reason
              : projection.reason}
        </p>
        {/* Health stars: secondary decoration, aria-hidden (§14). */}
        {health.configured > 0 && (
          <div className="pw-today-truth-stars" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`pw-today-star ${i < health.meter ? "pw-today-star--on" : ""}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Summary cards (§16): scannable, only when real data ─── */}
      <section className="pw-today-grid" aria-label="World overview">
        {/* World health card */}
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

        {/* Reminders — quiet, only when active */}
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

        {/* Projects: calm summary when attention needed */}
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

        {/* Agent activity: active work, NOT attention. Calm. */}
        {hasAgentActivity && (
          <div className="pw-today-card pw-today-card--quiet">
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

        {/* Recent journal — only when entries exist */}
        {journalEntries.length > 0 && (
          <div className="pw-today-card pw-today-card--wide">
            <div className="pw-today-card-header">
              <Icon name="icon-navigation-journal" size={18} className="pw-today-card-icon" aria-hidden />
              <h2 className="pw-today-card-title">Recent Writing</h2>
              <Link to="/journal" className="pw-today-card-link">View all →</Link>
            </div>
            <div className="pw-today-card-body">
              <div className="pw-today-journal-entries">
                {journalEntries.slice(0, 3).map((entry: any, i: number) => {
                  const date = new Date(entry.ts);
                  const dayLabel = date.toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                  });
                  return (
                    <div key={i} className="pw-today-journal-entry">
                      <p className="pw-today-journal-text">{entry.text.slice(0, 120)}</p>
                      <p className="pw-today-journal-time">{dayLabel}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Attention items (§16.4) — only when real ───────────── */}
      {isAttention && projection.items && projection.items.length > 0 && (
        <section className="pw-today-attention" aria-label="Needs attention">
          <h2 className="pw-today-section-title">Needs Attention</h2>
          <div className="pw-today-attention-items">
            {projection.items.map((item) => (
              <div key={item.id} className="pw-today-attention-row">
                <StatusChip status="needs_attention" size="sm" />
                <span>{item.summary}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Daily loop: buried in progressive disclosure ────────── */}
      <footer className="pw-today-footer">
        <details className="pw-today-daily">
          <summary className="pw-today-daily-trigger">Advanced</summary>
          <div className="pw-today-daily-body">
            <button
              type="button"
              className="pw-today-daily-btn"
              onClick={runDaily}
              disabled={dailyRunning}
            >
              {dailyRunning ? "Running…" : "Run daily loop"}
            </button>
            {dailyResult && (
              <p className="pw-today-daily-result">{dailyResult}</p>
            )}
          </div>
        </details>
      </footer>
    </div>
  );
}
