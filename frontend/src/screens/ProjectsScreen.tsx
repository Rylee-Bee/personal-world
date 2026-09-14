import { useState } from "react";
import {
  useSourceControlStatus,
  useSourceControlHistory,
  useSourceControlEnrichment,
  useAgentSyncProjects,
} from "../lib/hooks";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { Disclosure } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import "./projects-screen.css";

function asCanonicalStatus(raw: string | undefined | null): CanonicalStatus {
  const known: readonly string[] = [
    "healthy", "warning", "unknown", "needs_attention",
    "unavailable", "stale", "disabled", "not_configured",
  ];
  return raw && known.includes(raw) ? (raw as CanonicalStatus) : "unknown";
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
          <section aria-label="Agent-sync projects" data-pw-projects="agent-sync">
            <ul>
              {agentProjects.map((p: any) => (
                <li key={p.repo || p.name}>
                  <StatusChip status={asCanonicalStatus(p.status)} size="sm" />
                  {" "}
                  {p.repo || p.name}
                  {p.summary ? ` — ${p.summary}` : ""}
                </li>
              ))}
            </ul>
          </section>
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
    <article
      className={`pw-project-card ${isAttention ? "pw-project-card--attention" : ""}`}
      role="listitem"
    >
      <div className="pw-project-card-main">
        <div className="pw-project-card-icon" aria-hidden="true">
          <span className="pw-project-card-icon-inner" />
        </div>

        <div className="pw-project-card-content">
          <div className="pw-project-card-header">
            <h2 className="pw-project-card-name">{repo.name || repo.path}</h2>
            <span className={`pw-project-status pw-project-status--${status}`} role="status">
              <span className="pw-project-status-dot" aria-hidden="true" />
              {isAttention ? "needs attention" : "healthy"}
              <span className="pw-project-status-sparkle" aria-hidden="true">&#10022;</span>
            </span>
          </div>

          <p className="pw-project-card-description">
            {repo.description || repo.path || "No description"}
          </p>

          <div className="pw-project-card-footer">
            {repo.branch && (
              <span className="pw-project-card-footer-item">
                <span aria-hidden="true">&uarr;</span> {repo.branch}
                {repo.dirty && <span className="pw-project-card-dirty">&rarr; deployed</span>}
              </span>
            )}
            {commits.length > 0 && (
              <span className="pw-project-card-footer-item">
                {commits.length} commits this week
              </span>
            )}
            {enrichmentData && (
              <>
                {'open_issues' in enrichmentData && enrichmentData.open_issues !== null && enrichmentData.open_issues !== undefined && (
                  <span className="pw-project-card-footer-item">
                    {enrichmentData.open_issues} open issues
                  </span>
                )}
                {'open_prs' in enrichmentData && enrichmentData.open_prs !== null && enrichmentData.open_prs !== undefined && (
                  <span className="pw-project-card-footer-item">
                    {enrichmentData.open_prs} PR waiting
                  </span>
                )}
              </>
            )}
          </div>
        </div>
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
                  <code>{(c.sha || "").slice(0, 7)}</code>
                  {" "}
                  {c.message ? c.message.split("\n")[0] : "(no message)"}
                  {c.author ? ` — ${c.author}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
        {enrichmentData && (
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
    </article>
  );
}
