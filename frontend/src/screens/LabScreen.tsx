import { EmptyState } from "../shell/EmptyState";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { TechnicalDetails, Disclosure } from "../primitives/Disclosure";
import {
  useLabState,
  useNativeLabInventory,
  useNativeLabHealth,
  useNativeLabResources,
  useReconcilerStatus,
  useIngressRollups,
} from "../lib/hooks";
import type { LabEnvelope } from "../lib/api";
import { Loader2 } from "../lib/icons";
import LabOperationsPanel from "./LabOperationsPanel";

interface LabObservation {
  detail: string;
  action?: string | null;
  state?: string;
  observed_at?: string;
}

interface LabRow {
  row: string;
  count: number;
  stale?: boolean;
  unrecognized?: boolean;
  observations?: LabObservation[];
}

interface LabStateData {
  rows?: LabRow[];
  schema?: string;
  generated_at?: string;
  reason?: string;
}

interface NativeService {
  name: string;
  type: string;
  status: string;
}

interface NativeHealthSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
}

function asCanonicalStatus(raw: string | undefined | null): CanonicalStatus {
  const known: readonly string[] = [
    "healthy", "warning", "unknown", "needs_attention",
    "unavailable", "stale", "disabled", "not_configured",
  ];
  return raw && known.includes(raw) ? (raw as CanonicalStatus) : "unknown";
}

function rowLabel(row: string): string {
  return row.replace(/_/g, " ");
}

function observedAtLabel(observed_at: string | undefined): string | undefined {
  if (!observed_at) return undefined;
  const ts = new Date(observed_at);
  if (Number.isNaN(ts.getTime())) return undefined;
  return `observed ${ts.toLocaleString()}`;
}

export default function LabScreen() {
  const lab = useLabState();
  const nativeInventory = useNativeLabInventory();
  const nativeHealth = useNativeLabHealth();
  const nativeResources = useNativeLabResources();
  const reconciler = useReconcilerStatus();
  const ingress = useIngressRollups();

  const isLoading = lab.isLoading || nativeInventory.isLoading;

  if (isLoading) {
    return (
      <div data-pw-lab="loading">
        <h1 id="lab-heading">Lab</h1>
        <p>
          <Loader2 className="loader-static" aria-hidden={true} /> Checking your
          lab…
        </p>
      </div>
    );
  }

  const nativeInventoryData = nativeInventory.data?.data;
  const nativeHealthData = nativeHealth.data?.data;
  const nativeResourcesData = nativeResources.data?.data;
  const reconcilerData = reconciler.data?.data;

  const nativeServices: NativeService[] = nativeInventoryData?.services || [];
  const healthSummary: NativeHealthSummary | null = nativeHealthData?.summary || null;

  const state: LabEnvelope | null = lab.data ?? null;
  const stateData = (state?.data ?? null) as LabStateData | null;
  const rows = stateData?.rows ?? [];

  const hasNativeData = nativeServices.length > 0;
  const hasHomelabData = state?.ok && rows.length > 0;

  return (
    <div data-pw-lab="screen">
      <h1 id="lab-heading">Lab</h1>

      {/* Native Lab — service inventory + health */}
      <section aria-label="Service inventory" data-pw-lab="native-inventory">
        <h2>Services</h2>
        {nativeInventory.data?.ok ? (
          <>
            <p>
              {healthSummary
                ? `${healthSummary.total} service${healthSummary.total === 1 ? "" : "s"} — ${healthSummary.healthy} healthy, ${healthSummary.unhealthy} unhealthy, ${healthSummary.unknown} unknown`
                : `${nativeServices.length} service${nativeServices.length === 1 ? "" : "s"} in inventory`}
            </p>
            {nativeServices.length > 0 ? (
              <table data-pw-lab-table="native-services">
                <caption className="sr-only">Native Lab service inventory</caption>
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nativeServices.map((s) => (
                    <tr key={s.name}>
                      <th scope="row">{s.name}</th>
                      <td>{s.type}</td>
                      <td>
                        <StatusChip status={asCanonicalStatus(s.status)} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No services configured yet. Add services to your lab inventory to monitor them.</p>
            )}
          </>
        ) : (
          <p>Native Lab inventory unavailable.</p>
        )}
      </section>

      {/* Native Lab — resources */}
      {nativeResourcesData && (
        <Disclosure summary="System resources" level={2}>
          <section aria-label="System resources" data-pw-lab="native-resources">
            <ul>
              {nativeResourcesData.cpu_count && (
                <li>CPU cores: {nativeResourcesData.cpu_count}</li>
              )}
              {nativeResourcesData.memory && (
                <li>
                  Memory: {nativeResourcesData.memory.available
                    ? `${Math.round(nativeResourcesData.memory.available / 1024 / 1024 / 1024)} GB available`
                    : "unknown"}
                </li>
              )}
              {nativeResourcesData.disk && (
                <li>
                  Disk: {nativeResourcesData.disk.free
                    ? `${Math.round(nativeResourcesData.disk.free / 1024 / 1024 / 1024)} GB free`
                    : "unknown"}
                </li>
              )}
            </ul>
          </section>
        </Disclosure>
      )}

      {/* Reconciler — desired state drift */}
      {reconcilerData && reconcilerData.services.length > 0 && (
        <Disclosure summary="Settings reconciliation" level={2}>
          <section aria-label="Settings reconciliation" data-pw-lab="reconciler">
            <p>{reconcilerData.services.length} service{reconcilerData.services.length === 1 ? "" : "s"} with desired state defined.</p>
            <ul>
              {reconcilerData.services.map((s: any) => (
                <li key={s.name}>
                  <StatusChip status="healthy" size="sm" /> {s.name}
                </li>
              ))}
            </ul>
          </section>
        </Disclosure>
      )}

      {/* Homelab enrichment — Lab CLI operator rows (when available) */}
      {hasHomelabData && (
        <Disclosure summary="Homelab operator data" level={2}>
          <section aria-label="Homelab operator data" data-pw-lab="homelab">
            <p>
              Enriched from your homelab Lab CLI. This supplements the native inventory above.
            </p>
            <table data-pw-lab-table="operator-rows">
              <caption className="sr-only">Homelab operator rows</caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Items</th>
                  <th scope="col">State</th>
                  <th scope="col">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const chipStatus: CanonicalStatus = r.unrecognized
                    ? "unknown"
                    : r.stale
                      ? "stale"
                      : "healthy";
                  return (
                    <tr key={r.row} data-pw-lab-row={r.row}>
                      <th scope="row">{rowLabel(r.row)}</th>
                      <td>{r.count}</td>
                      <td>
                        {r.unrecognized
                          ? "unrecognized row"
                          : r.observations && r.observations.length > 0
                            ? (r.observations[0].state ?? "unknown").replace(/_/g, " ")
                            : "clear"}
                      </td>
                      <td>
                        <StatusChip status={chipStatus} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows
              .filter((r) => (r.observations?.length ?? 0) > 0)
              .map((r) => (
                <TechnicalDetails
                  key={r.row}
                  provider="lab state (homelab Lab CLI)"
                  latency={observedAtLabel(r.observations?.[0]?.observed_at)}
                  raw={JSON.stringify(r.observations?.[0] ?? {})}
                />
              ))}
            <LabOperationsPanel />
          </section>
        </Disclosure>
      )}

      {/* Ingress — Traefik route rollups */}
      {ingress.data?.ok && ingress.data.routes && ingress.data.routes.length > 0 && (
        <Disclosure summary="Ingress routes" level={2}>
          <section aria-label="Ingress routes" data-pw-lab="ingress">
            <p>{ingress.data.routes.length} route{ingress.data.routes.length === 1 ? "" : "s"} configured.</p>
            <table data-pw-lab-table="ingress-routes">
              <caption className="sr-only">Ingress routes</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Rule</th>
                  <th scope="col">Service</th>
                  <th scope="col">TLS</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {ingress.data.routes.map((r) => (
                  <tr key={r.name}>
                    <th scope="row">{r.name}</th>
                    <td>{r.rule || "—"}</td>
                    <td>{r.service || "—"}</td>
                    <td>{r.tls ? "Yes" : "No"}</td>
                    <td>
                      <StatusChip status={asCanonicalStatus(r.status)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </Disclosure>
      )}
      {ingress.data && !ingress.data.ok && (
        <section aria-label="Ingress status" data-pw-lab="ingress-unavailable">
          <h2>Ingress</h2>
          <p>Ingress provider not configured.</p>
        </section>
      )}

      {/* Neither available */}
      {!hasNativeData && !hasHomelabData && !ingress.data?.ok && (
        <EmptyState
          title="Lab"
          headingLevel={2}
          capability="Lab monitors your services, health, and settings."
          knob="No services configured. Add services to your lab inventory or connect a homelab Lab CLI."
          status="not_configured"
        />
      )}
    </div>
  );
}
