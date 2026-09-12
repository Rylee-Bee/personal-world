import { TechnicalDetails } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import {
  useLabSettings,
  useLabDeploy,
  useLabSecrets,
  useLabResources,
} from "../lib/hooks";
import type { LabEnvelope } from "../lib/api";

/**
 * LabOperationsPanel (capability wiring, 2026-09-12): the remaining
 * read-only lab operations the backend already serves — Settings
 * Reconciler drift, deploy status/ledger, secret audit (names only,
 * never values), VM resources — each via the same homelab Lab CLI the
 * operator table consumes. Nothing here computes homelab truth: every
 * line is the envelope's own data, and an absent or failing CLI
 * degrades to the canonical not_configured/unavailable chip with the
 * server's warning, never a guessed row.
 *
 * This panel mounts ONLY inside its disclosure (zero fetches in the
 * calm default view), mirroring the Journal audit-trail pattern.
 * Mutation is out of scope: these routes are read-only; repair /
 * restart flows are proposal work (P5) and stay out of this panel.
 */

interface LabSettingsData {
  total?: number;
  drifted?: number;
  healthy?: number;
  services?: Array<{ service?: string; status?: string }>;
}

interface LabDeployData {
  total?: number;
  running?: number;
  containers?: Array<Record<string, unknown>>;
  recent_deploys?: Array<Record<string, unknown>>;
}

interface LabSecretsData {
  total_services?: number;
  rendered?: number;
  sops_decryptable?: boolean;
}

interface LabResourcesData {
  cpu?: string;
  memory?: string;
  disk?: string;
  docker?: string;
}

/** Canonical-status guard (same vocabulary as the operator table). */
function asCanonicalStatus(raw: string | undefined | null): CanonicalStatus {
  const known: readonly string[] = [
    "healthy", "warning", "unknown", "needs_attention",
    "unavailable", "stale", "disabled", "not_configured",
  ];
  return raw && known.includes(raw) ? (raw as CanonicalStatus) : "unknown";
}

function OperationLine(props: {
  label: string;
  envelope: LabEnvelope | undefined;
  error: Error | null;
  summary: (data: unknown) => string | null;
  provider: string;
  refetch: () => Promise<void>;
}) {
  const { label, envelope, error, summary, provider, refetch } = props;
  const status = asCanonicalStatus(envelope?.status);
  const data = envelope?.data ?? null;
  let sentence: string;
  if (error !== null) {
    sentence = `Could not reach the server for the ${label.toLowerCase()} observation.`;
  } else if (!envelope || envelope.ok === false) {
    sentence = envelope?.warnings?.[0] ?? `${label} is not available right now.`;
  } else {
    const s = summary(data);
    sentence = s ?? "The lab answered but reported no detail.";
  }
  return (
    <div data-pw-lab-operation={label.toLowerCase()}>
      <p>
        <StatusChip status={status} size="sm" /> {sentence}
      </p>
      {(envelope?.data !== undefined || error !== null) && (
        <TechnicalDetails
          provider={provider}
          raw={
            error !== null
              ? error.message
              : JSON.stringify(envelope?.warnings?.length
                  ? { data: envelope.data, warnings: envelope.warnings }
                  : envelope?.data ?? {})
          }
        />
      )}
      {status === "unavailable" && (
        <button type="button" onClick={() => void refetch()}>
          Try again
        </button>
      )}
    </div>
  );
}

export default function LabOperationsPanel() {
  const settings = useLabSettings(true);
  const deploy = useLabDeploy(true);
  const secrets = useLabSecrets(true);
  const resources = useLabResources(true);

  return (
    <section aria-label="Lab operations" data-pw-lab="operations">
      <OperationLine
        label="Settings"
        envelope={settings.data}
        error={settings.error}
        refetch={() => settings.refetch()}
        provider="lab settings status (homelab Lab CLI)"
        summary={(d) => {
          const s = d as LabSettingsData | null;
          if (!s || typeof s.total !== "number") return null;
          return typeof s.drifted === "number" && s.drifted > 0
            ? `${s.drifted} of ${s.total} services drifted from desired state.`
            : `${s.total} services match their desired state.`;
        }}
      />
      <OperationLine
        label="Deploy"
        envelope={deploy.data}
        error={deploy.error}
        refetch={() => deploy.refetch()}
        provider="lab deploy status + ledger (homelab Lab CLI)"
        summary={(d) => {
          const s = d as LabDeployData | null;
          if (!s || typeof s.total !== "number") return null;
          const base =
            typeof s.running === "number"
              ? `${s.running} of ${s.total} containers running`
              : `${s.total} containers observed`;
          const deploys = Array.isArray(s.recent_deploys)
            ? `; ${s.recent_deploys.length} recent deploys in the ledger`
            : "";
          return `${base}${deploys}.`;
        }}
      />
      <OperationLine
        label="Secrets"
        envelope={secrets.data}
        error={secrets.error}
        refetch={() => secrets.refetch()}
        provider="lab secret audit — names and render state only, never values (homelab Lab CLI)"
        summary={(d) => {
          const s = d as LabSecretsData | null;
          if (!s || typeof s.total_services !== "number") return null;
          const rendered = typeof s.rendered === "number" ? s.rendered : 0;
          return `${rendered} of ${s.total_services} services have secrets rendered on the VM; the audit reports names only, never values.`;
        }}
      />
      <OperationLine
        label="Resources"
        envelope={resources.data}
        error={resources.error}
        refetch={() => resources.refetch()}
        provider="lab resources (homelab Lab CLI)"
        summary={(d) => {
          const r = d as LabResourcesData | null;
          if (!r) return null;
          const parts = [
            typeof r.memory === "string" ? r.memory.split("\n")[1] : null,
            typeof r.disk === "string" ? r.disk.split("\n")[1] : null,
          ].filter((x): x is string => typeof x === "string" && x.trim() !== "");
          return parts.length > 0 ? parts.join(" · ") : null;
        }}
      />
    </section>
  );
}