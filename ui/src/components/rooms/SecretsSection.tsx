/**
 * SecretsSection — the Workshop's secrets, by name (canvas boards
 * Secrets-Overview and Secrets-States, 2026-09-26).
 *
 * Shown in the Workshop's drawer, for the owner only: the overview
 * endpoint answers 403 to anyone else, and then this section isn't there
 * at all. What it shows is names and health, never a value:
 *
 *   - the station's health in words, with a lamp that is never the only
 *     signal (lit = answering, hollow = anything else);
 *   - agents' requests, each linking to Project Home's trusted page, the
 *     one place a value is ever typed (Worlds has no value field);
 *   - key names grouped by namespace, closed until opened;
 *   - recent changes, and whether each reached the station.
 *
 * No reveal, no copy, no export, no delete. If the station is down, only
 * this section rests; the rest of the drawer carries on.
 */
import { Icon } from "../Icon";
import { useId, useState } from "react";
import { ApiError } from "../../data/api";
import { useSecretsOverview } from "../../data/hooks";
import type { SecretsOverview } from "../../data/contract";
import { formatTime, LINK_BASE, plural, sitePathUrl } from "./format";

const SECTION_TITLE =
  "mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-text-muted)]";
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const MICRO = "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]";
const CODE = "break-all font-mono text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]";

function Lamp({ lit }: { lit: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-[var(--pw-radius-full)] border-2 ${
        lit
          ? "border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm)]"
          : "border-[var(--pw-text-muted)] bg-transparent"
      }`}
    />
  );
}

/** Station health in words: never a colour alone, never a guess. */
function stationWords(data: SecretsOverview): { lit: boolean; title: string; line: string | null } {
  const { status, detail } = data.station;
  const groups = data.namespaces.length;
  switch (status) {
    case "ok":
      return {
        lit: true,
        title: "Connected",
        line: [
          data.bundle_last_change ? `Last change reached it ${formatTime(data.bundle_last_change)}.` : null,
          `${plural(data.key_count, "key", "keys")} in ${plural(groups, "group", "groups")}.`,
        ]
          .filter(Boolean)
          .join(" "),
      };
    case "unreachable":
      return {
        lit: false,
        title: "Can’t reach the station right now",
        line: `Nothing can be saved until it’s back. The rest of Worlds carries on as normal.${
          detail ? ` (${detail})` : ""
        }`,
      };
    case "not_configured":
      return {
        lit: false,
        title: "No secrets station yet",
        line: "Project Home can keep your station’s secrets once it’s connected to one. Until then there’s nothing to show, and nothing is missing.",
      };
    default:
      return {
        lit: false,
        title: "Worlds can’t read your secrets right now",
        line: detail ? `${detail.charAt(0).toUpperCase()}${detail.slice(1)}.` : "It won’t guess what’s there.",
      };
  }
}

/**
 * What happened to a change, in words (Project Home's values, 2026-09-26):
 * `state` is encrypted | committed | pushed | failed | unchanged, and
 * `deploy_state` is pending (when pushed) or unknown; applied | verified
 * mean the station reported it back. Only those two light the lamp, and
 * anything unrecognised shows the station's own word, never success.
 */
function changeWords(op: SecretsOverview["recent_ops"][number]): { lit: boolean; words: string } {
  const deploy = (op.deploy_state ?? "").toLowerCase();
  const state = (op.state ?? "").toLowerCase();
  if (state === "failed") return { lit: false, words: "didn’t save · old value kept" };
  if (state === "unchanged") return { lit: false, words: "already set, nothing changed" };
  if (deploy === "applied" || deploy === "verified") return { lit: true, words: "reached the station" };
  if (state === "pushed") return { lit: false, words: "waiting for the station" };
  if (state === "encrypted" || state === "committed") {
    return { lit: false, words: "saved · not sent to the station yet" };
  }
  const word = state || deploy;
  return { lit: false, words: word ? `station says “${word}”` : "not known yet what happened" };
}

function Namespace({ name, keys }: { name: string; keys: string[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li className="border-t border-[var(--pw-border-subtle)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex min-h-[var(--pw-targets-minimum)] w-full items-center gap-[var(--pw-spacing-sm)] bg-transparent text-left font-semibold text-[var(--pw-text-primary)]"
      >
        <span aria-hidden="true" className="flex w-4 text-[var(--pw-accent-warm)]">
          <Icon name={open ? "chevron-down" : "chevron-right"} size={16} />
        </span>
        <span className="min-w-0 flex-1 break-words">{name}</span>
        <span className={`${SMALL} font-normal`}>{plural(keys.length, "key", "keys")}</span>
      </button>
      <ul id={panelId} hidden={!open} className="pb-[var(--pw-spacing-sm)] pl-[var(--pw-spacing-lg)]">
        {keys.map((key) => (
          <li key={key} className={`${CODE} border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-xs)]`}>
            {key}
          </li>
        ))}
      </ul>
    </li>
  );
}

export function SecretsSection({ headingId }: { headingId: string }) {
  const overview = useSecretsOverview();

  // Not the owner: the section isn't there at all.
  if (overview.error instanceof ApiError && overview.error.status === 403) return null;

  const trusted = overview.data?.data?.open_url ?? null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-[var(--pw-spacing-md)]">
      <div>
        <h3 id={headingId} className={SECTION_TITLE}>
          Secrets
        </h3>
        <p className={SMALL}>
          What your station keeps, by name. Values are only ever typed in Project Home, and never shown here.
        </p>
      </div>

      {overview.isPending ? (
        <p className={SMALL} role="status">
          Checking your secrets…
        </p>
      ) : overview.isError || !overview.data?.data ? (
        <p className={SMALL} role="status">
          Worlds couldn’t read your secrets just now. Nothing has changed.
        </p>
      ) : (
        <SecretsBody data={overview.data.data} trusted={trusted} />
      )}
    </section>
  );
}

function SecretsBody({ data, trusted }: { data: SecretsOverview; trusted: string | null }) {
  const station = stationWords(data);
  const requests = data.requests.filter((r) => r.key_path);
  const ops = data.recent_ops.filter((o) => o.key_path).slice(0, 5);

  return (
    <>
      <div className="flex items-start gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]">
        <Lamp lit={station.lit} />
        <div className="min-w-0">
          <p className="font-semibold text-[var(--pw-text-primary)]">{station.title}</p>
          {station.line && <p className={SMALL}>{station.line}</p>}
        </div>
      </div>

      {requests.length > 0 && (
        <div>
          <h4 className="mb-[var(--pw-spacing-xs)] font-semibold text-[var(--pw-text-primary)]">
            {`Waiting for you · ${requests.length}`}
          </h4>
          <ul className="flex flex-col gap-[var(--pw-spacing-sm)]">
            {requests.map((req, i) => {
              // A request's link is a path on the Workshop's own site;
              // it opens there, or falls back to the trusted page.
              const href = (trusted && sitePathUrl(trusted, req.link)) ?? trusted;
              return (
                <li
                  key={req.id ?? `${req.key_path}-${i}`}
                  className="flex flex-col gap-[var(--pw-spacing-xs)] rounded-[var(--pw-radius-md)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
                >
                  <span className="font-semibold text-[var(--pw-text-primary)]">
                    An agent asked for <code className={CODE}>{req.key_path}</code>
                  </span>
                  {req.reason && <span className={SMALL}>{`“${req.reason}”`}</span>}
                  <span className={MICRO}>
                    {[
                      req.requested_at ? `Asked ${formatTime(req.requested_at)}` : null,
                      "nothing is shared until you enter it",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {href && (
                    <span>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Enter ${req.key_path} in Project Home, in a new tab`}
                        className={`${LINK_BASE} gap-[var(--pw-spacing-xs)] bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)]`}
                      >
                        Enter it in Project Home
                        <Icon name="external" size={16} />
                      </a>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data.namespaces.length > 0 && (
        <div>
          <h4 className="font-semibold text-[var(--pw-text-primary)]">
            Keys <span className={`${SMALL} font-normal`}>· names only, never values</span>
          </h4>
          <ul>
            {data.namespaces.map((ns) => (
              <Namespace key={ns.name} name={ns.name} keys={ns.keys} />
            ))}
          </ul>
        </div>
      )}

      {ops.length > 0 && (
        <div>
          <h4 className="mb-[var(--pw-spacing-xs)] font-semibold text-[var(--pw-text-primary)]">What changed</h4>
          <ul>
            {ops.map((op, i) => {
              const change = changeWords(op);
              return (
                <li
                  key={`${op.key_path}-${op.created_at ?? i}`}
                  className="flex flex-col gap-[2px] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)]"
                >
                  <code className={CODE}>{op.key_path}</code>
                  <span className={`${SMALL} flex items-start gap-[var(--pw-spacing-xs)]`}>
                    <Lamp lit={change.lit} />
                    <span>
                      {[op.actor, op.created_at ? formatTime(op.created_at) : null, change.words]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={MICRO}>Never the value, and never the old value.</p>
        </div>
      )}

      {trusted && (
        <span>
          <a
            href={trusted}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Set a secret in Project Home, in a new tab"
            className={`${LINK_BASE} gap-[var(--pw-spacing-xs)] border border-[var(--pw-border-subtle)] text-[var(--pw-text-primary)] underline`}
          >
            Set a secret in Project Home
            <Icon name="external" size={16} />
          </a>
        </span>
      )}
    </>
  );
}
