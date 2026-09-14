import { useState, type FormEvent } from "react";
import {
  usePrincipal,
  useWorldStatus,
  useActors,
  useManifest,
} from "../lib/hooks";
import { useCompanion, COMPANIONS } from "../lib/companion-context";
import {
  fetchExportSettings,
  fetchExportStory,
  fetchBackup,
  fetchWorld,
  saveWorldIntent,
  saveWorldFact,
  saveWorldPolicy,
} from "../lib/api";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { Disclosure } from "../primitives/Disclosure";
import "./world-screen.css";

interface ManifestEntry {
  name: string;
  native: boolean;
  provider: string | null;
  status?: string;
}

interface Actor {
  name: string;
  role?: string;
  status?: string;
  description?: string;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isManifestArray(data: unknown): data is ManifestEntry[] {
  return Array.isArray(data);
}

function isActorArray(data: unknown): data is Actor[] {
  return Array.isArray(data);
}

function CapIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("source") || n.includes("control") || n.includes("git"))
    return <span className="pw-world-cap-icon" aria-hidden="true">&#9881;</span>;
  if (n.includes("calendar") || n.includes("schedule"))
    return <span className="pw-world-cap-icon" aria-hidden="true">&#9783;</span>;
  if (n.includes("note") || n.includes("journal"))
    return <span className="pw-world-cap-icon" aria-hidden="true">&#9783;</span>;
  if (n.includes("weather"))
    return <span className="pw-world-cap-icon" aria-hidden="true">&#9729;</span>;
  if (n.includes("mail") || n.includes("email"))
    return <span className="pw-world-cap-icon" aria-hidden="true">&#9993;</span>;
  if (n.includes("contact"))
    return <span className="pw-world-cap-icon" aria-hidden="true">&#9787;</span>;
  if (n.includes("notif"))
    return <span className="pw-world-cap-icon" aria-hidden="true">&#9854;</span>;
  return <span className="pw-world-cap-icon" aria-hidden="true">&#10022;</span>;
}

export default function WorldScreen() {
  const principal = usePrincipal();
  const worldStatus = useWorldStatus();
  const actors = useActors();
  const manifest = useManifest();
  const { companion } = useCompanion();
  const companionMeta = COMPANIONS[companion];

  const worldName =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || "Your World"
      : "Your World";

  const worldData = worldStatus.data;
  const capabilities = worldData?.capabilities || {};
  const healthyCaps = Object.values(capabilities).filter(
    (c: any) => c.ok
  ).length;

  const actorList: Actor[] = isActorArray(actors.data) ? actors.data : [];

  const manifestEntries: ManifestEntry[] = isManifestArray(manifest.data)
    ? manifest.data
    : [];

  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(kind: "settings" | "story" | "backup" | "world") {
    setDownloading(kind);
    try {
      let data: unknown;
      let filename: string;
      switch (kind) {
        case "settings":
          data = await fetchExportSettings();
          filename = "world-settings.json";
          break;
        case "story":
          data = await fetchExportStory();
          filename = "world-story.json";
          break;
        case "backup":
          data = await fetchBackup();
          filename = "world-backup.json";
          break;
        case "world":
          data = await fetchWorld();
          filename = "world.json";
          break;
      }
      downloadJson(filename, data);
    } catch {
      // errors surface via isLoading/error states elsewhere
    } finally {
      setDownloading(null);
    }
  }

  const capEntries = manifestEntries.length > 0
    ? manifestEntries
    : Object.entries(capabilities).map(([name, c]: [string, any]) => ({
        name,
        native: true,
        provider: null,
        status: c.ok ? "healthy" : "needs_attention",
      }));

  return (
    <div className="pw-world">
      <div className="pw-world-ambient" aria-hidden="true" />

      <section className="pw-world-header" aria-labelledby="world-heading">
        <div className="pw-world-orb" aria-hidden="true">
          <div className="pw-world-orb-glow" />
          <div className="pw-world-orb-ring" />
        </div>
        <div className="pw-world-header-copy">
          <p className="pw-world-eyebrow">{worldName}&apos;s Personal World</p>
          <h1 id="world-heading" className="pw-world-title">
            Your World
          </h1>
          <p className="pw-world-subtitle">
            Everything here belongs to you. This is what your world can see.
          </p>
          <p className="pw-world-watch-note">
            <span aria-hidden="true">&#10022;</span> keeping watch over all of this
          </p>
        </div>
      </section>

      <div className="pw-world-strip" role="status" aria-label="World status">
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-icon" aria-hidden="true">&#9675;</span>
          <p className="pw-world-strip-label">World active</p>
        </div>
        <div className="pw-world-strip-divider" aria-hidden="true" />
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-icon" aria-hidden="true">&#10022;</span>
          <p className="pw-world-strip-label">
            {healthyCaps} capabilities connected
          </p>
        </div>
        <div className="pw-world-strip-divider" aria-hidden="true" />
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-dot" aria-hidden="true" />
          <p className="pw-world-strip-label">
            Last healthy check: just now
          </p>
        </div>
      </div>

      <div className="pw-world-columns">
        <div className="pw-world-main">
          <section className="pw-world-caps" aria-label="Capabilities">
            <div className="pw-world-caps-header">
              <h2 className="pw-world-caps-title">What your world can see</h2>
              <span className="pw-world-caps-subtitle">what it can perceive</span>
            </div>
            {capEntries.length > 0 ? (
              <div className="pw-world-cap-grid">
                {capEntries.map((cap) => (
                  <div
                    key={cap.name}
                    className={`pw-world-cap-card ${cap.status === "needs_attention" ? "pw-world-cap-card--attention" : ""}`}
                  >
                    <div className="pw-world-cap-card-header">
                      <CapIcon name={cap.name} />
                      <span className="pw-world-cap-card-name">{cap.name}</span>
                      {cap.status === "healthy" && (
                        <span className="pw-world-cap-card-dot pw-world-cap-card-dot--healthy" aria-label="healthy" />
                      )}
                    </div>
                    <p className="pw-world-cap-card-desc">
                      {cap.provider ? `via ${cap.provider}` : "Your " + cap.name.toLowerCase()}
                    </p>
                    <p className="pw-world-cap-card-status">
                      {cap.status === "healthy" ? "healthy" : cap.status === "needs_attention" ? "needs attention" : cap.status || "not configured"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pw-world-empty">No capabilities registered.</p>
            )}
          </section>

          <Disclosure summary="Capability manifest" level={2}>
            {manifest.isLoading ? (
              <p className="pw-world-empty">Loading manifest&hellip;</p>
            ) : manifestEntries.length === 0 ? (
              <p className="pw-world-empty">No capabilities registered.</p>
            ) : (
              <table className="pw-world-manifest-table">
                <caption className="sr-only">Capability manifest</caption>
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">Native</th>
                    <th scope="col">Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {manifestEntries.map((entry) => (
                    <tr key={entry.name}>
                      <td>{entry.name}</td>
                      <td>{entry.native ? "Yes" : "No"}</td>
                      <td>{entry.provider ?? "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Disclosure>

          <Disclosure summary="Export &amp; backup" level={2}>
            <div className="pw-world-export-grid">
              <button type="button" className="pw-world-export-btn" disabled={downloading !== null} onClick={() => handleDownload("world")}>
                {downloading === "world" ? "Downloading\u2026" : "World (full)"}
              </button>
              <button type="button" className="pw-world-export-btn" disabled={downloading !== null} onClick={() => handleDownload("settings")}>
                {downloading === "settings" ? "Downloading\u2026" : "Settings"}
              </button>
              <button type="button" className="pw-world-export-btn" disabled={downloading !== null} onClick={() => handleDownload("story")}>
                {downloading === "story" ? "Downloading\u2026" : "Story"}
              </button>
              <button type="button" className="pw-world-export-btn" disabled={downloading !== null} onClick={() => handleDownload("backup")}>
                {downloading === "backup" ? "Downloading\u2026" : "Backup"}
              </button>
            </div>
          </Disclosure>

          <Disclosure summary="World writes" level={2}>
            <p className="pw-world-write-note">
              These write directly to your world state. Changes are journaled.
            </p>
            <WorldWriteForm kind="intent" label="Intent" placeholder="e.g. travel_more" />
            <WorldWriteForm kind="fact" label="Fact" placeholder="e.g. prefers_morning_light" />
            <WorldWriteForm kind="policy" label="Policy" placeholder="e.g. no_notifications_after_9pm" />
          </Disclosure>
        </div>

        <aside className="pw-world-sidebar" aria-label="Who is here">
          <div className="pw-world-actors">
            <h2 className="pw-world-actors-title">Who&apos;s here</h2>
            <p className="pw-world-actors-subtitle">A field guide to inhabitants &amp; visitors</p>
            {actorList.length > 0 ? (
              <ul className="pw-world-actors-list" role="list">
                {actorList.map((actor, i) => (
                  <li key={`${actor.name}-${i}`} className="pw-world-actor">
                    <div className="pw-world-actor-icon" aria-hidden="true">
                      <span className="pw-world-actor-icon-inner" />
                    </div>
                    <div className="pw-world-actor-text">
                      <span className="pw-world-actor-name">{actor.name}</span>
                      <span className="pw-world-actor-desc">
                        {actor.description || actor.role || "visitor"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pw-world-empty-small">No actors detected.</p>
            )}
            <p className="pw-world-actors-footer">Visitors leave a little history behind.</p>
          </div>
        </aside>
      </div>

      <footer className="pw-world-companion" aria-label="Companion presence">
        <CompanionSlot size="nav" />
        <div className="pw-world-companion-text">
          <span className="pw-world-companion-name">{companionMeta?.name || "Your companion"}</span>
          <span className="pw-world-companion-status">
            Your world is calm. I&apos;m here if anything stirs.
          </span>
        </div>
      </footer>
    </div>
  );
}

function WorldWriteForm({
  kind,
  label,
  placeholder,
}: {
  kind: "intent" | "fact" | "policy";
  label: string;
  placeholder: string;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      if (kind === "intent") {
        await saveWorldIntent(key.trim(), value.trim());
      } else if (kind === "fact") {
        await saveWorldFact(key.trim(), value.trim());
      } else {
        await saveWorldPolicy(key.trim(), value.trim());
      }
      setStatus("done");
      setKey("");
      setValue("");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Write failed.");
    }
  }

  return (
    <form className="pw-world-write-form" onSubmit={handleSubmit}>
      <fieldset className="pw-world-write-fieldset">
        <legend className="pw-world-write-legend">{label}</legend>
        <div className="pw-world-write-fields">
          <label className="pw-world-write-label">
            <span className="sr-only">Key</span>
            <input
              className="pw-world-write-input"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={placeholder}
              required
            />
          </label>
          <label className="pw-world-write-label">
            <span className="sr-only">Value</span>
            <input
              className="pw-world-write-input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="value (optional for policy)"
            />
          </label>
          <button
            type="submit"
            className="pw-world-export-btn"
            disabled={status === "sending" || !key.trim()}
          >
            {status === "sending" ? "Writing\u2026" : `Set ${label}`}
          </button>
        </div>
        {status === "done" && (
          <p className="pw-world-write-status" role="status">Saved.</p>
        )}
        {status === "error" && (
          <p className="pw-world-write-status pw-world-write-status--error" role="alert">
            {errorMsg}
          </p>
        )}
      </fieldset>
    </form>
  );
}
