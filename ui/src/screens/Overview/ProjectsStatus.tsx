/**
 * ProjectsStatus — the parked-Projects ruling (TRUE-NORTH, owner
 * refinement 2): Projects stays parked as a full surface, but
 * Overview keeps a deterministic path from source to details —
 * every status row links to its authoritative source, and
 * agent-sync remains the authoritative feed.
 *
 * Source: GET /api/projects/status (api.py projects_status) — a
 * dated agent-sync observation. Quiet degradation is the contract:
 * command absent / timeout / malformed output answer an honest
 * ok:false "unavailable" envelope, and this section says exactly
 * that with the row shape designed in beside it. A row without a
 * recorded remote links nowhere and says so — Git owns Git truth,
 * and a missing remote is never guessed.
 */

import { useProjectsStatus } from "../../data/hooks";
import { projectsViewState } from "./home-loop";

export function ProjectsStatus() {
  const query = useProjectsStatus();
  const view = projectsViewState(query.data, query.isError);

  return (
    <section aria-label="Projects" className="mb-[var(--pw-spacing-2xl)]">
      <h2 className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
        Projects
      </h2>
      <div className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
        {view.kind === "unavailable" ? (
          <>
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              No project source yet. The agent-sync observation is
              unavailable on this station
              {view.warning ? ` — ${view.warning}` : ""}.
            </p>
            <p className="mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              When it answers, each project appears here as a row
              linking to its own source.
            </p>
          </>
        ) : view.kind === "empty" ? (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            agent-sync answered with an empty registry — no projects
            are registered with it yet.
          </p>
        ) : (
          <>
            <p className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              agent-sync observation · {view.freshnessWords}
              {view.observedLabel ? ` · ${view.observedLabel}` : ""}
            </p>
            <ul role="list" className="space-y-[var(--pw-spacing-sm)]">
              {view.rows.map((row) => (
                <li
                  key={row.key}
                  className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-md)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-[var(--pw-spacing-sm)]">
                    <p className="text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
                      {row.name}
                      {row.branch ? (
                        <span className="text-[var(--pw-text-muted)]">
                          {" "}
                          · {row.branch}
                        </span>
                      ) : null}
                    </p>
                    {row.sourceUrl ? (
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex min-h-[var(--pw-targets-minimum)] items-center text-[length:var(--pw-typography-size_micro)] font-medium text-[var(--pw-accent-primary)] underline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
                        aria-label={`Open the source of ${row.name}`}
                      >
                        source
                      </a>
                    ) : (
                      <span className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                        no remote recorded
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
                    {row.publishWords} · {row.workWords} · {row.safeWords}
                    {row.openWork ? ` · ${row.openWork}` : ""}
                  </p>
                  {row.errorText ? (
                    <p className="mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-accent-warm)]">
                      agent-sync could not read this project:{" "}
                      {row.errorText}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
