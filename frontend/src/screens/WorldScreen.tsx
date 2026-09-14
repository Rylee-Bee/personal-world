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
  type WorldStatus,
} from "../lib/api";
import { Disclosure } from "../primitives/Disclosure";
import "./world-screen.css";

interface ManifestEntry {
  name: string;
  native: boolean;
  provider: string | null;
  status?: string;
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
  const capCount = Object.keys(capabilities).length;
  const healthyCaps = Object.values(capabilities).filter(
    (c: any) => c.ok
  ).length;

  const actorList = (actors.data || []) as WorldStatus["actors"];
  const healthyActors = actorList.filter((a) => a.status === "healthy").length;

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

  return (
    <div className="pw-world">
      <section className="pw-world-header" aria-labelledby="world-heading">
        <div className="pw-world-orb" aria-hidden="true">
          <div className="pw-world-orb-glow" />
          <div className="pw-world-orb-ring" />
        </div>
        <div className="pw-world-header-copy">
          <p className="pw-world-eyebrow">Personal World</p>
          <h1 id="world-heading" className="pw-world-title">
            {worldName}
          </h1>
          <p className="pw-world-subtitle">
            Everything here belongs to you.
          </p>
          <p className="pw-world-watch-note">
            <span aria-hidden="true">✦</span> keeping watch over all of this
          </p>
        </div>
      </section>

      <div className="pw-world-strip" role="status" aria-label="World status">
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-dot" aria-hidden="true" />
          <p className="pw-world-strip-label">World active</p>
        </div>
        <div className="pw-world-strip-divider" aria-hidden="true" />
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-dot" aria-hidden="true" />
          <p className="pw-world-strip-label">
            {healthyCaps}/{capCount} capabilities healthy
          </p>
        </div>
        <div className="pw-world-strip-divider" aria-hidden="true" />
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-dot" aria-hidden="true" />
          <p className="pw-world-strip-label">
            {healthyActors} provider{healthyActors === 1 ? "" : "s"} connected
          </p>
        </div>
      </div>

      <section className="pw-world-companion" aria-label="Companion presence">
        <div className="pw-world-companion-art" aria-hidden="true">
          <div className="pw-world-companion-figure" />
          <span className="pw-world-companion-bubble" />
          <span className="pw-world-companion-bubble pw-world-companion-bubble--small" />
          <span className="pw-world-companion-sparkle" />
        </div>
        <div className="pw-world-companion-copy">
          <p className="pw-world-companion-name">{companionMeta?.name || "Your companion"}</p>
          <p className="pw-world-companion-body">
            Present and aware, always — keeping watch over your world, sensing what changes, what needs attention, and what can stay quiet.
          </p>
          <div className="pw-world-companion-presence">
            <span className="pw-world-companion-presence-dot" aria-hidden="true" />
            <p className="pw-world-companion-presence-label">Present — watching</p>
          </div>
        </div>
      </section>

      <Disclosure summary="Capability manifest" level={2}>
        {manifest.isLoading ? (
          <p className="pw-world-manifest-empty">Loading manifest…</p>
        ) : manifest.isError ? (
          <p className="pw-world-manifest-empty">Manifest unavailable.</p>
        ) : manifestEntries.length === 0 ? (
          <p className="pw-world-manifest-empty">No capabilities registered.</p>
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
                  <td>{entry.provider ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Disclosure>

      <Disclosure summary="Export &amp; backup" level={2}>
        <div className="pw-world-export-grid">
          <button
            type="button"
            className="pw-world-export-btn"
            disabled={downloading !== null}
            onClick={() => handleDownload("world")}
          >
            {downloading === "world" ? "Downloading…" : "World (full)"}
          </button>
          <button
            type="button"
            className="pw-world-export-btn"
            disabled={downloading !== null}
            onClick={() => handleDownload("settings")}
          >
            {downloading === "settings" ? "Downloading…" : "Settings"}
          </button>
          <button
            type="button"
            className="pw-world-export-btn"
            disabled={downloading !== null}
            onClick={() => handleDownload("story")}
          >
            {downloading === "story" ? "Downloading…" : "Story"}
          </button>
          <button
            type="button"
            className="pw-world-export-btn"
            disabled={downloading !== null}
            onClick={() => handleDownload("backup")}
          >
            {downloading === "backup" ? "Downloading…" : "Backup"}
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
            {status === "sending" ? "Writing…" : `Set ${label}`}
          </button>
        </div>
        {status === "done" && (
          <p className="pw-world-write-status" role="status">
            Saved.
          </p>
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
