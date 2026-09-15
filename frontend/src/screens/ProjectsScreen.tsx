import { useState } from "react";
import {
  useSourceControlStatus,
  useSourceControlHistory,
  useSourceControlEnrichment,
  useAgentSyncProjects,
} from "../lib/hooks";
import type { AgentSyncProject } from "../lib/api";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { Disclosure } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import {
  CATEGORY_ORDER,
  NEEDS_ATTENTION,
  projectCategory,
  projectSentence,
  type ProjectCategory,
} from "../lib/project-status";
import { observedSentence, staleSuffix } from "../lib/observation-age";
import "./projects-screen.css";

/**
 * Coarse canonical chip status (status.py vocabulary) for an estate
 * category. `lib/project-status.ts` stays the one categorization
 * (shared with Today) — this screen must never re-implement it. The
 * five categories stay distinct: the chip label carries the category
 * word and the sentence carries its human meaning, so nothing is
 * collapsed into one generic "warning".
 */
function categoryChip(category: ProjectCategory): CanonicalStatus {
  if (NEEDS_ATTENTION.includes(category)) return "needs_attention";
  if (category === "unknown") return "unknown";
  return "healthy";
}

/** The category word, rendered as the chip label. */
const CATEGORY_WORD: Record<ProjectCategory, string> = {
  diverged: "diverged",
  unpublished: "unpublished",
  unknown: "unknown",
  local_work: "local work",
  quiet: "quiet",
};

/**
 * ProjectEstate: the shared estate vocabulary rendered calmly — a
 * glance line naming only the categories that exist, one plain
 * sentence per project that is not quiet (never a suggested Git
 * command), the dated observation line (freshness is provenance, not
 * failure), and the technical guts behind one disclosure.
 *
 * agent-sync stays authoritative for the observation; nothing here
 * computes Git state. Verbs and freshness come only from the shared
 * helpers (`lib/project-status.ts`, `lib/observation-age.ts`).
 */
function ProjectEstate({
  projects,
  observedAt,
}: {
  projects: AgentSyncProject[];
  observedAt: string | null;
}) {
  const categories = projects.map(projectCategory);
  const count = (c: ProjectCategory) =>
    categories.filter((x) => x === c).length;
  const needsAttention = categories.filter((c) =>
    NEEDS_ATTENTION.includes(c)
  ).length;

  // The calm glance: one line, only categories that exist. Ordinary
  // local development is never alarm; quiet machinery stays quiet.
  const bits: string[] = [];
  if (needsAttention > 0) {
    bits.push(
      needsAttention === 1
        ? "1 needs attention"
        : `${needsAttention} need attention`
    );
  }
  if (count("local_work") > 0) {
    bits.push(
      count("local_work") === 1
        ? "1 has local work in progress"
        : `${count("local_work")} have local work in progress`
    );
  }
  if (count("unknown") > 0) {
    bits.push(
      count("unknown") === 1
        ? "1 could not reach its remote"
        : `${count("unknown")} could not reach their remotes`
    );
  }
  const quiet = count("quiet");
  const glance =
    (quiet > 0 ? `${quiet} quiet — ` : "") + bits.join(" · ");

  // One shared age sentence. Stale is provenance, not failure: "may
  // be stale", never ERROR/OUTDATED/DANGER vocabulary.
  const ageLine = `${observedSentence(observedAt)}${staleSuffix(observedAt)} by agent-sync — a dated observation, not live truth.`;

  const ordered = [...projects].sort(
    (a, b) =>
      CATEGORY_ORDER[projectCategory(a)] -
      CATEGORY_ORDER[projectCategory(b)]
  );

  return (
    <section aria-label="Agent-sync projects" data-pw-projects="agent-sync">
      {bits.length === 0 ? (
        <p data-pw-projects-status="quiet">
          {projects.length === 1
            ? "Your project is settled."
            : `All ${projects.length} projects are settled.`}
        </p>
      ) : (
        <p data-pw-projects-status="glance">{glance}</p>
      )}

      <ul data-pw-projects-status-list>
        {ordered.map((p) => {
          const category = projectCategory(p);
          const sentence = projectSentence(p);
          return (
            <li key={p.project} data-pw-projects-status-item={category}>
              <StatusChip
                status={categoryChip(category)}
                label={CATEGORY_WORD[category]}
                size="sm"
              />{" "}
              <strong>{p.project}</strong>
              {sentence ? ` — ${sentence}` : ""}
            </li>
          );
        })}
      </ul>

      <p data-pw-projects-status="age">{ageLine}</p>

      {/* Technical guts: exactly where they belong — one disclosure
          below the calm sentence list, never on the first glance. */}
      <Disclosure summary="Project details (technical)" level={2}>
        <ul>
          {ordered.map((p) => {
            const tree = p.working_tree;
            return (
              <li key={p.project} data-pw-projects-guts={p.project}>
                <p>
                  <strong>{p.project}</strong>
                </p>
                <dl>
                  <div>
                    <dt>Publish state</dt>
                    <dd>{p.publish_state ?? "unknown"}</dd>
                  </div>
                  <div>
                    <dt>Safe to leave</dt>
                    <dd>{p.safe_to_leave}</dd>
                  </div>
                  <div>
                    <dt>Local head</dt>
                    <dd>{p.local_head?.slice(0, 7) ?? "unknown"}</dd>
                  </div>
                  <div>
                    <dt>Remote head</dt>
                    <dd>{p.remote_head?.slice(0, 7) ?? "unknown"}</dd>
                  </div>
                  <div>
                    <dt>Working tree</dt>
                    <dd>
                      {tree.staged} staged, {tree.modified} modified,{" "}
                      {tree.untracked} untracked, {tree.conflicted} conflicted
                    </dd>
                  </div>
                  <div>
                    <dt>Work state</dt>
                    <dd>{p.work_state}</dd>
                  </div>
                  <div>
                    <dt>Play-Nice</dt>
                    <dd>
                      {p.play_nice.present
                        ? `adopted${p.play_nice.revision ? ` @ ${p.play_nice.revision.slice(0, 7)}` : ""}`
                        : "not adopted"}
                    </dd>
                  </div>
                  <div>
                    <dt>Observed</dt>
                    <dd>
                      {`${observedSentence(observedAt)}${staleSuffix(observedAt)}`}
                      {observedAt ? ` (${observedAt})` : ""}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </Disclosure>
    </section>
  );
}

export default function ProjectsScreen() {
  const sourceControl = useSourceControlStatus();
  const agentSync = useAgentSyncProjects();

  const scData = sourceControl.data;
  const repos = scData?.data?.repos || [];
  const scWarnings = scData?.warnings || [];

  const agentData = agentSync.data?.data;
  const agentProjects = agentData?.projects || [];

  const healthyCount = repos.filter((r: any) => !r.ok === false).length;
  const attentionCount = repos.length - healthyCount;

  return (
    <div className="pw-projects">
      <div className="pw-projects-ambient" aria-hidden="true" />

      <header className="pw-projects-header">
        <div className="pw-projects-title-row">
          <span className="pw-projects-title-icon" aria-hidden="true">&#9881;</span>
          <h1 className="pw-projects-title">Projects</h1>
        </div>
        <div className="pw-projects-header-meta">
          <p className="pw-projects-subtitle">
            Your repositories, builds, and code.
          </p>
          <span className="pw-projects-stats">
            {repos.length} project{repos.length === 1 ? "" : "s"} connected
            {repos.length > 0 && (
              <>
                {" "}&middot; {healthyCount} healthy
                {attentionCount > 0 && ` ${attentionCount} needs attention`}
              </>
            )}
          </span>
          <span className="pw-projects-header-sparkles" aria-hidden="true">
            &#10022;&#10022;&#10022;
          </span>
        </div>
      </header>

      {repos.length > 0 ? (
        <div className="pw-projects-list" role="list" aria-label="Repositories">
          {repos.map((repo: any) => (
            <RepoCard key={repo.name || repo.path} repo={repo} />
          ))}
        </div>
      ) : (
        <div className="pw-projects-empty" role="status">
          {sourceControl.isLoading ? (
            <p className="pw-projects-empty-text">Connecting to source control&hellip;</p>
          ) : (
            <>
              <p className="pw-projects-empty-title">No repositories found</p>
              <p className="pw-projects-empty-text">
                {scWarnings.length > 0
                  ? scWarnings[0]
                  : "Configure source control search paths to see your repositories here."}
              </p>
            </>
          )}
        </div>
      )}

      {agentProjects.length > 0 && (
        <Disclosure summary="Agent-sync project estate" level={2}>
          <ProjectEstate
            projects={agentProjects}
            observedAt={agentData?.observed_at ?? null}
          />
        </Disclosure>
      )}

      <footer className="pw-projects-footer">
        <span className="pw-projects-footer-sparkle" aria-hidden="true">&#10022;</span>
        <span className="pw-projects-footer-text">Watching your projects</span>
      </footer>

      <div className="pw-projects-companion" aria-hidden="true">
        <CompanionSlot size="empty" />
        <span className="pw-projects-companion-label">quietly here</span>
      </div>
    </div>
  );
}

function RepoCard({ repo }: { repo: any }) {
  const [showHistory, setShowHistory] = useState(false);
  const history = useSourceControlHistory(
    repo.path || repo.name,
    5,
    { enabled: showHistory }
  );
  const enrichment = useSourceControlEnrichment(
    repo.path || repo.name,
    { enabled: showHistory }
  );

  const status: CanonicalStatus = repo.ok === false ? "needs_attention" : "healthy";
  const commits = history.data?.commits || [];
  const enrichmentData = enrichment.data?.data;
  const isAttention = status === "needs_attention";

  return (
    <div className="pw-project-card" role="listitem">
      <div className="pw-project-card-header">
        <h2 className="pw-project-card-name">{repo.name || repo.path}</h2>
        <span className={`pw-project-status pw-project-status--${status}`} role="status">
          <span className="pw-project-status-dot" aria-hidden="true" />
          {status === "healthy" ? "Healthy" : "Needs attention"}
        </span>
      </div>

      {isAttention && repo.last_activity && (
        <p className="pw-project-card-attention-note">
          Last successful deploy: {repo.last_activity}
        </p>
      )}

      <Disclosure
        summary="History & details"
        level={3}
        onOpenChange={(open) => {
          if (open) setShowHistory(true);
        }}
      >
        {commits.length > 0 && (
          <section aria-label="Recent commits">
            <h4>Recent commits</h4>
            <ul>
              {commits.map((c: any, i: number) => (
                <li key={i}>
                  <code>{(c.revision || "").slice(0, 7)}</code>
                  {" "}
                  {c.subject ? c.subject.split("\n")[0] : "(no message)"}
                  {c.author ? ` — ${c.author}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
        {enrichment.data?.ok !== false && enrichmentData && (
          <section aria-label="GitHub enrichment">
            <h4>Remote enrichment</h4>
            <ul>
              {'open_prs' in enrichmentData && enrichmentData.open_prs !== null && enrichmentData.open_prs !== undefined && (
                <li>Open PRs: {enrichmentData.open_prs}</li>
              )}
              {'open_issues' in enrichmentData && enrichmentData.open_issues !== null && enrichmentData.open_issues !== undefined && (
                <li>Open issues: {enrichmentData.open_issues}</li>
              )}
              {'default_branch' in enrichmentData && enrichmentData.default_branch && (
                <li>Default branch: {enrichmentData.default_branch}</li>
              )}
              {'url' in enrichmentData && enrichmentData.url && (
                <li>Remote: {enrichmentData.url}</li>
              )}
            </ul>
          </section>
        )}
        {history.isLoading && <p>Loading history&hellip;</p>}
        {history.isError && <p>Could not load history.</p>}
      </Disclosure>

      {repo.warnings && repo.warnings.length > 0 && (
        <p className="pw-project-warning">{repo.warnings[0]}</p>
      )}
    </div>
  );
}
