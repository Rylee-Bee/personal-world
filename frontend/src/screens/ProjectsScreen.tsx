import { usePrincipal, useSourceControlStatus } from "../lib/hooks";
import "./projects-screen.css";

function statusLabel(status: string): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "active":
      return "In progress";
    case "attention":
      return "Needs attention";
    case "unavailable":
      return "Unavailable";
    case "not_configured":
      return "Not configured";
    default:
      return status;
  }
}

function statusFromSource(ok: boolean, warnings: string[]): "healthy" | "attention" {
  return ok && warnings.length === 0 ? "healthy" : "attention";
}

export default function ProjectsScreen() {
  const principal = usePrincipal();
  const sourceControl = useSourceControlStatus();
  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  const scData = sourceControl.data;
  const repos = scData?.data?.repos || [];
  const scOk = scData?.ok ?? false;
  const scWarnings = scData?.warnings || [];

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

      {repos.length > 0 ? (
        <div className="pw-projects-cards" role="list" aria-label="Projects">
          {repos.map((repo: any) => {
            const status = statusFromSource(repo.ok !== false, repo.warnings || []);
            return (
              <article
                key={repo.name || repo.path}
                className="pw-project-card"
                role="listitem"
              >
                <div className="pw-project-card-header">
                  <h2 className="pw-project-card-name">{repo.name || repo.path}</h2>
                  <span
                    className={`pw-project-status pw-project-status--${status}`}
                    role="status"
                  >
                    <span className="pw-project-status-dot" aria-hidden="true" />
                    {statusLabel(status)}
                  </span>
                </div>

                <p className="pw-project-card-description">
                  {repo.description || repo.path || "No description"}
                </p>

                <div className="pw-project-card-footer">
                  {repo.branch && (
                    <span className="pw-project-card-footer-item">
                      {repo.branch}
                    </span>
                  )}
                  {repo.last_commit && (
                    <span className="pw-project-card-footer-item">
                      {repo.last_commit}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pw-projects-empty" role="status">
          <p className="pw-projects-empty-title">No projects found</p>
          <p className="pw-projects-empty-body">
            {scWarnings.length > 0
              ? scWarnings[0]
              : "Configure source control to see your repositories here."}
          </p>
        </div>
      )}
    </div>
  );
}
