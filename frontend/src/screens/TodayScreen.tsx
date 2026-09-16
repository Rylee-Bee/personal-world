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
import { useCompanion, COMPANIONS } from "../lib/companion-context";
import "./today-screen.css";

/**
 * TodayScreen — §16.1 "Today — Quiet Day"
 *
 * Purpose: Answer "Does anything need me?" with honest stillness.
 * Register: AMBIENT, with generous breathing room.
 * Figma: 17:481
 *
 * "Nothing needs you right now. Your world is running on its own."
 *
 * The screen leads with a human greeting and date, then a single
 * honest sentence about the world's state. Companion presence is
 * meaningful but not obligatory. Real recent context follows only
 * when there is something genuine to show.
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

  // Future Today states (Question, Reservation, Attention) will use
  // daily.data.warnings and daily.data.actions from this hook.
  void daily.data;

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

  const totalAttention = health.attention.length + reposNeedingAttention.length + activeAgentProjects.length;

  // §11: Determine the honest truth sentence for the world state.
  const truthSentence = totalAttention === 0
    ? health.unavailable.length > 0
      ? "Your world continues. Some things are unavailable."
      : "Nothing needs you right now."
    : totalAttention === 1
      ? "One thing needs your attention."
      : `${totalAttention} things need your attention.`;

  return (
    <div className="pw-today">
      {/* §16.1: Greeting — expressive heading, date, and truth sentence. */}
      <section className="pw-today-welcome" aria-labelledby="today-greeting">
        <div className="pw-today-greeting">
          <h1 id="today-greeting" className="pw-today-greeting-text">
            Good morning{name ? `, ${name}` : ""}. <span aria-hidden="true">✦</span>
          </h1>
          <p className="pw-today-date">
            {dayName}, {monthDay}
          </p>
          {/* §11: Honest status — one sentence, never a traffic light. */}
          <p className="pw-today-truth" role="status" aria-label="World state">
            {truthSentence}
          </p>
        </div>

        {/* §10/§16.1: Companion presence — meaningful but not obligatory.
            Uses real companion artwork, not CSS placeholders.
            "Recompose canonical Mermaid or selected companion at the
            intended scene scale." */}
        <div className="pw-today-companion" aria-hidden="true">
          <div className="pw-today-companion-art">
            <img
              src={companionIcon}
              alt=""
              className="pw-today-companion-img"
            />
          </div>
        </div>
      </section>

      {/* §16.1: "Quiet continuation into writing or real recent context.
          Do not fill every region." Only render sections with real content. */}

      {/* Active reminders — only when they exist */}
      {activeReminders.length > 0 && (
        <section className="pw-today-section" aria-label="Active reminders">
          <h2 className="pw-today-section-title">Active Reminders</h2>
          <ul className="pw-today-reminder-list">
            {activeReminders.map((r) => (
              <li key={r.id} className="pw-today-reminder">{r.text}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Project attention — only when something genuinely needs it */}
      {reposNeedingAttention.length > 0 && (
        <section className="pw-today-section" aria-label="Project attention">
          <h2 className="pw-today-section-title">Projects</h2>
          <div className="pw-today-items">
            {reposNeedingAttention.map((repo) => (
              <div key={repo.name} className="pw-today-item">
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
            ))}
          </div>
        </section>
      )}

      {/* Agent activity — only when something is active */}
      {activeAgentProjects.length > 0 && (
        <section className="pw-today-section" aria-label="Agent activity">
          <h2 className="pw-today-section-title">Agent Activity</h2>
          <div className="pw-today-items">
            {activeAgentProjects.map((p) => (
              <div key={p.project} className="pw-today-item">
                <strong>{p.project}</strong>
                {` — ${p.work_state}`}
                {p.branch ? ` (${p.branch})` : ""}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent journal — only when entries exist */}
      {journalEntries.length > 0 && (
        <section className="pw-today-section" aria-label="Recent journal">
          <h2 className="pw-today-section-title">Recent Writing</h2>
          <div className="pw-today-entries">
            {journalEntries.map((entry: any, i: number) => {
              const date = new Date(entry.ts);
              const dayLabel = date.toLocaleDateString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" });
              return (
                <div key={i} className="pw-today-entry">
                  <div className="pw-today-entry-copy">
                    <p className="pw-today-entry-text">{entry.text.slice(0, 120)}</p>
                    <p className="pw-today-entry-time">{dayLabel}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* §7: "Healthy silence is valid. Empty space does not create an
          obligation to invent recommendations, activity, or tasks."
          No filler section when nothing needs attention. */}

      {/* Daily loop trigger — collapsible, never prominent */}
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
