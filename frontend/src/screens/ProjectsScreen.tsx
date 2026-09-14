import { useState } from "react";
import {
  usePrincipal,
  useSourceControlStatus,
  useSourceControlHistory,
  useSourceControlEnrichment,
  useAgentSyncProjects,
} from "../lib/hooks";
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
  const principal = usePrincipal();
  const sourceControl = useSourceControlStatus();
  const agentSync = useAgentSyncProjects();

  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  const scData = sourceControl.data;
  const repos = scData?.data?.repos || [];
  const scOk = scData?.ok ?? false;
  const scWarnings = scData?.warnings || [];

  const agentData = agentSync.data?.data;
  const agentProjects = agentData?.projects || [];

  return (
    <div className="pw-projects">
      <nav className="pw-projects-breadcrumb" aria-label="Breadcrumb">
        <span>{name ? `${name}'s world` : "Your world"}</span>
        <span className="pw-projects-breadcrumb-sep" aria-hidden="true">/</span>
        <span className="pw-projects-breadcrumb-current">Projects</span>
      </nav>

      <header className="pw-projects-header">
        <h1 className="pw-projects-title">Projects</h1>
        <p className="pw-projects-subtitle">
          Your repositories, builds, and code.
        </p>
      </header>

      <div className="pw-projects-companion" role="status">
        <span className="pw-projects-companion-sparkle" aria-hidden="true">✦</span>
        <span>
          {scOk
            ? `Watching ${repos.length} project${repos.length === 1 ? "" : "s"}`
            : sourceControl.isLoading
              ? "Connecting to source control..."
              : "Source control not configured"}
        </span>
      </div>

      {/* Repository cards */}
      {repos.length > 0 ? (
        <div className="pw-projects-cards" role="list" aria-label="Repositories">
          {repos.map((repo: any) => (
            <RepoCard key={repo.name || repo.path} repo={repo} />
          ))}
        </div>
      ) : (
        <div className="pw-projects-empty" role="status">
          <p className="pw-projects-empty-title">No repositories found</p>
          <p className="pw-projects-empty-body">
            {scWarnings.length > 0
              ? scWarnings[0]
              : "Configure source control search paths to see your repositories here."}
          </p>
        </div>
      )}

      {/* Agent-sync project estate */}
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

  return (
    <article className="pw-project-card" role="listitem">
      <div className="pw-project-card-header">
        <h2 className="pw-project-card-name">{repo.name || repo.path}</h2>
        <span className={`pw-project-status pw-project-status--${status}`} role="status">
          <span className="pw-project-status-dot" aria-hidden="true" />
          {status === "healthy" ? "Healthy" : "Needs attention"}
        </span>
      </div>

      <p className="pw-project-card-description">
        {repo.description || repo.path || "No description"}
      </p>

      <div className="pw-project-card-footer">
        {repo.branch && (
          <span className="pw-project-card-footer-item">{repo.branch}</span>
        )}
        {repo.revision && (
          <span className="pw-project-card-footer-item">{repo.revision.slice(0, 7)}</span>
        )}
        {repo.dirty && (
          <span className="pw-project-card-footer-item pw-project-card-footer-item--warning">dirty</span>
        )}
        {repo.ahead !== undefined && repo.ahead > 0 && (
          <span className="pw-project-card-footer-item">ahead {repo.ahead}</span>
        )}
        {repo.behind !== undefined && repo.behind > 0 && (
          <span className="pw-project-card-footer-item">behind {repo.behind}</span>
        )}
      </div>

      {/* Expandable: history + enrichment */}
      <Disclosure
        summary="History & details"
        level={3}
        onOpenChange={(open) => {
          if (open) setShowHistory(true);
        }}
      >
        {/* Commit history */}
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

        {/* GitHub enrichment */}
        {enrichmentData && 'open_prs' in enrichmentData && (
          <section aria-label="GitHub enrichment">
            <h4>Remote enrichment</h4>
            <ul>
              {enrichmentData.open_prs !== null && enrichmentData.open_prs !== undefined && (
                <li>Open PRs: {enrichmentData.open_prs}</li>
              )}
              {enrichmentData.open_issues !== null && enrichmentData.open_issues !== undefined && (
                <li>Open issues: {enrichmentData.open_issues}</li>
              )}
              {enrichmentData.default_branch && (
                <li>Default branch: {enrichmentData.default_branch}</li>
              )}
              {enrichmentData.url && (
                <li>Remote: {enrichmentData.url}</li>
              )}
            </ul>
          </section>
        )}

        {history.isLoading && <p>Loading history…</p>}
        {history.isError && <p>Could not load history.</p>}
      </Disclosure>

      {repo.warnings && repo.warnings.length > 0 && (
        <p className="pw-project-warning">{repo.warnings[0]}</p>
      )}
    </article>
  );
}
