/**
 * PROJECT WORLDS — React Query Hooks
 *
 * Typed data-fetching hooks using openapi-fetch + TanStack Query.
 * Every hook is backed by the generated API client.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  healthz,
  getStatus,
  getDaily,
  listJournal,
  writeJournal,
  supersedeJournal,
  journalHistory,
  listChatProviders,
  sendChat,
  chatHistory,
  listProposals,
  getProposal,
  approveProposal,
  rejectProposal,
  listActors,
  getManifest,
  searchMemory,
  listBrainTemplates,
  listTools,
  getSession,
  getSetupStatus,
  getVaultStatus,
  listVaultNames,
  getVaultSecret,
  unlockVault,
  lockVault,
  setVaultSecret,
  deleteVaultSecret,
  getPrefs,
  putPrefs,
  getPrefsSchema,
  getSections,
  putSections,
  listReminders,
  addReminder,
  toggleReminder,
  deleteReminder,
  listApps,
  listThemes,
  getTheme,
  getConnectionsOverview,
  listConnections,
  getConnectionSchemas,
  saveConnection,
  deleteConnection,
  getPrincipal,
  putPrincipal,
  listUsers,
  listAgents,
  getDiscoveryStatus,
  listDiscoverySources,
  listDiscoveryInterests,
  getMediaStatus,
  getMediaLibrary,
  getMediaRecent,
  getMediaActivity,
} from "./api";
import type { components } from "../generated/api-types";
import type { CapabilitySummary, WorldSignal } from "./types";

// ===== Query Keys =====
export const queryKeys = {
  healthz: ["healthz"] as const,
  status: ["status"] as const,
  daily: ["daily"] as const,
  journal: ["journal"] as const,
  journalHistory: ["journal", "history"] as const,
  chatProviders: ["chat", "providers"] as const,
  chatHistory: ["chat", "history"] as const,
  proposals: ["proposals"] as const,
  proposal: (id: string) => ["proposals", id] as const,
  actors: ["actors"] as const,
  manifest: ["manifest"] as const,
  memory: (q: string) => ["memory", q] as const,
  brainTemplates: ["brain", "templates"] as const,
  tools: ["tools"] as const,
  session: ["session"] as const,
  setup: ["setup"] as const,
} as const;

// ===== Health =====
export function useHealthz() {
  return useQuery({
    queryKey: queryKeys.healthz,
    queryFn: healthz,
    staleTime: 30_000,
  });
}

// ===== Setup =====
export function useSetupStatus() {
  return useQuery({
    queryKey: queryKeys.setup,
    queryFn: getSetupStatus,
  });
}

// ===== World =====
export function useStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: getStatus,
    staleTime: 60_000,
  });
}

export function useDaily() {
  return useQuery({
    queryKey: queryKeys.daily,
    queryFn: getDaily,
    staleTime: 300_000, // 5 min — daily digest doesn't change fast
  });
}

// ===== Journal =====
export function useJournalList(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...queryKeys.journal, params],
    queryFn: () => listJournal(params),
  });
}

export function useWriteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: writeJournal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.journal });
      qc.invalidateQueries({ queryKey: queryKeys.daily });
    },
  });
}

export function useSupersedeJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supersedeJournal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.journal });
    },
  });
}

export function useJournalHistory(limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.journalHistory, limit],
    queryFn: () => journalHistory({ limit }),
  });
}

// ===== Chat =====
export function useChatProviders() {
  return useQuery({
    queryKey: queryKeys.chatProviders,
    queryFn: listChatProviders,
    staleTime: 60_000,
  });
}

export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendChat,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.chatHistory });
    },
  });
}

export function useChatHistory(limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.chatHistory, limit],
    queryFn: () => chatHistory({ limit }),
  });
}

// ===== Proposals =====
export function useProposals() {
  return useQuery({
    queryKey: queryKeys.proposals,
    queryFn: listProposals,
  });
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: queryKeys.proposal(id),
    queryFn: () => getProposal(id),
    enabled: !!id,
  });
}

export function useApproveProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveProposal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.proposals });
    },
  });
}

export function useRejectProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectProposal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.proposals });
    },
  });
}

// ===== Actors =====
export function useActors() {
  return useQuery({
    queryKey: queryKeys.actors,
    queryFn: listActors,
    staleTime: 120_000,
  });
}

// ===== Manifest =====
export function useManifest() {
  return useQuery({
    queryKey: queryKeys.manifest,
    queryFn: getManifest,
    staleTime: 300_000,
  });
}

// ===== Memory =====
export function useMemorySearch(q: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.memory(q),
    queryFn: () => searchMemory(q),
    enabled: enabled && q.length > 0,
    staleTime: 60_000,
  });
}

// ===== Brain =====
export function useBrainTemplates() {
  return useQuery({
    queryKey: queryKeys.brainTemplates,
    queryFn: listBrainTemplates,
    staleTime: 300_000,
  });
}

// ===== Tools =====
export function useTools() {
  return useQuery({
    queryKey: queryKeys.tools,
    queryFn: listTools,
    staleTime: 300_000,
  });
}

// ===== Auth =====
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: getSession,
    staleTime: 30_000,
    retry: false,
  });
}

// ===== Vault =====
//
// Backend contract (openapi.json → VaultStatusResponse / VaultNamesResponse):
// every vault response is an `{ok, data}` envelope and there is NO
// secret_count on status — the count is derived from the names list.

export function useVaultStatus() {
  return useQuery({
    queryKey: ["vault", "status"],
    queryFn: getVaultStatus,
  });
}

/**
 * Secret names. Only meaningful while the vault is unlocked — the
 * backend answers 409 when locked — so callers pass `enabled: false`
 * while locked to avoid doomed requests.
 */
export function useVaultNames(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["vault", "names"],
    queryFn: listVaultNames,
    enabled: options?.enabled ?? true,
  });
}

export function useVaultSecret(name: string) {
  return useQuery({
    queryKey: ["vault", "secret", name],
    queryFn: () => getVaultSecret(name),
    enabled: !!name,
  });
}

/** Unlock returns `{ok, status, data?, warnings?}` — `ok:false` is a failure, not a throw. */
async function vaultAction(fn: () => Promise<{ ok?: boolean; status?: string; warnings?: string[] }>) {
  const res = await fn();
  if (res?.ok === false) {
    throw new Error(res.warnings?.[0] || res.status || "Vault action failed");
  }
  return res;
}

export function useUnlockVault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (passphrase: string) =>
      vaultAction(() => unlockVault(passphrase)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault"] });
    },
  });
}

export function useLockVault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => vaultAction(lockVault),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault"] });
    },
  });
}

export function useSetVaultSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) =>
      vaultAction(() => setVaultSecret(name, value)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault"] });
    },
  });
}

export function useDeleteVaultSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => vaultAction(() => deleteVaultSecret(name)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault"] });
    },
  });
}

// ===== Prefs =====
export function usePrefs() {
  return useQuery({
    queryKey: ["prefs"],
    queryFn: getPrefs,
  });
}

export function usePutPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putPrefs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prefs"] });
    },
  });
}

export function usePrefsSchema() {
  return useQuery({
    queryKey: ["prefs", "schema"],
    queryFn: getPrefsSchema,
    staleTime: 300_000,
  });
}

// ===== Sections =====
export function useSections() {
  return useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });
}

export function usePutSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putSections,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
    },
  });
}

// ===== Reminders =====
export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: listReminders,
  });
}

export function useAddReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addReminder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useToggleReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rid, enabled }: { rid: string; enabled: boolean }) => toggleReminder(rid, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteReminder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

// ===== Apps =====
export function useApps() {
  return useQuery({
    queryKey: ["apps"],
    queryFn: listApps,
  });
}

// ===== Themes =====
export function useThemes() {
  return useQuery({
    queryKey: ["themes"],
    queryFn: listThemes,
  });
}

export function useTheme(name: string) {
  return useQuery({
    queryKey: ["themes", name],
    queryFn: () => getTheme(name),
    enabled: !!name,
  });
}

// ===== Connections =====
export function useConnectionsOverview() {
  return useQuery({
    queryKey: ["connections", "overview"],
    queryFn: getConnectionsOverview,
  });
}

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: listConnections,
  });
}

export function useConnectionSchemas() {
  return useQuery({
    queryKey: ["connections", "schemas"],
    queryFn: getConnectionSchemas,
    staleTime: 300_000,
  });
}

export function useSaveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveConnection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteConnection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });
}

// ===== Identity =====
export function usePrincipal() {
  return useQuery({
    queryKey: ["identity", "principal"],
    queryFn: getPrincipal,
  });
}

export function usePutPrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putPrincipal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["identity", "principal"] });
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["identity", "users"],
    queryFn: listUsers,
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ["identity", "agents"],
    queryFn: listAgents,
  });
}

// ===== Discovery =====
export function useDiscoveryStatus() {
  return useQuery({
    queryKey: ["discovery", "status"],
    queryFn: getDiscoveryStatus,
  });
}

export function useDiscoverySources() {
  return useQuery({
    queryKey: ["discovery", "sources"],
    queryFn: listDiscoverySources,
  });
}

export function useDiscoveryInterests() {
  return useQuery({
    queryKey: ["discovery", "interests"],
    queryFn: listDiscoveryInterests,
  });
}

// ===== Media =====
export function useMediaStatus() {
  return useQuery({
    queryKey: ["media", "status"],
    queryFn: getMediaStatus,
  });
}

export function useMediaLibrary() {
  return useQuery({
    queryKey: ["media", "library"],
    queryFn: getMediaLibrary,
  });
}

export function useMediaRecent() {
  return useQuery({
    queryKey: ["media", "recent"],
    queryFn: getMediaRecent,
  });
}

export function useMediaActivity() {
  return useQuery({
    queryKey: ["media", "activity"],
    queryFn: getMediaActivity,
  });
}

// ===== Projects =====
// TODO: uncomment when /api/projects/status is added to openapi.json
// export function useProjectsStatus() {
//   return useQuery({
//     queryKey: ["projects", "status"],
//     queryFn: getProjectsStatus,
//   });
// }

// ===== Source Control =====
// TODO: uncomment when /api/source-control/* is added to openapi.json
// export function useSourceControlStatus() {
//   return useQuery({
//     queryKey: ["source-control", "status"],
//     queryFn: getSourceControlStatus,
//   });
// }

// ===== Lab =====
// TODO: uncomment when /api/lab/* is added to openapi.json
// export function useLabState() {
//   return useQuery({
//     queryKey: ["lab", "state"],
//     queryFn: getLabState,
//   });
// }

// ===== Ingress =====
// TODO: uncomment when /api/ingress/rollups is added to openapi.json
// export function useIngressRollups() {
//   return useQuery({
//     queryKey: ["ingress", "rollups"],
//     queryFn: getIngressRollups,
//   });
// }

// ===== Updates =====
// TODO: uncomment when /api/updates is added to openapi.json
// export function useUpdates() {
//   return useQuery({
//     queryKey: ["updates"],
//     queryFn: getUpdates,
//   });
// }

// ===== Exports =====
// TODO: uncomment when /api/exports/* is added to openapi.json
// export function useExportSettings() {
//   return useQuery({
//     queryKey: ["exports", "settings"],
//     queryFn: exportSettings,
//   });
// }

// export function useExportWorld() {
//   return useQuery({
//     queryKey: ["exports", "world"],
//     queryFn: exportWorld,
//   });
// }

// export function useBackup() {
//   return useQuery({
//     queryKey: ["backup"],
//     queryFn: getBackup,
//   });
// }

// ===== Today Summary (composed) =====

/**
 * Explicit return type: without it the `{ data: undefined }` branch
 * widened to `any` (this project runs with strictNullChecks off), which
 * silently disabled typechecking of everything derived from the summary —
 * that is how an invented `level: "info"` signal ever compiled at all.
 */
export interface TodaySummaryData {
  greeting: string;
  resident?: Actor;
  capabilities: CapabilitySummary[];
  signals: WorldSignal[];
  daily: DailyDigest;
}

export function useTodaySummary(): {
  data: TodaySummaryData | undefined;
  isLoading: boolean;
  error: Error | undefined;
} {
  const status = useStatus();
  const daily = useDaily();
  const actors = useActors();

  const isLoading = status.isLoading || daily.isLoading || actors.isLoading;
  const error = status.error || daily.error || actors.error;

  if (isLoading || error || !status.data || !daily.data) {
    return { data: undefined, isLoading, error };
  }

  const capabilities: CapabilitySummary[] = Object.entries(status.data.capabilities || {}).map(
    ([id, cap]) => ({
      id,
      name: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      // CapabilityMap types status as bare string; the wire vocabulary is
      // CapabilityStatus (contract §1.3) — cast at the boundary.
      status: ((cap as { status?: string }).status || "unknown") as CapabilitySummary["status"],
      summary: (cap as { warnings?: string[] }).warnings?.[0],
    })
  );

  const signals: WorldSignal[] = (daily.data.reminders || []).slice(0, 3).map(
    (r: Record<string, unknown>, i: number) => ({
      id: `reminder-${i}`,
      // Reminders are not alarms — they surface as "A small update"
      // (WorldSignalLevel has no "info" tier; adding one would touch
      // labels + styles without a real urgency difference).
      level: "update" as const,
      title: "Reminder",
      description: typeof r.text === "string" ? r.text : "",
    })
  );

  return {
    data: {
      greeting: getGreeting(),
      resident: actors.data?.actors?.[0],
      capabilities,
      signals,
      daily: daily.data,
    },
    isLoading: false,
    error: undefined,
  };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

// ===== Type exports =====
export type WorldStatus = NonNullable<ReturnType<typeof useStatus>["data"]>;
export type DailyDigest = NonNullable<ReturnType<typeof useDaily>["data"]>;
export type JournalList = NonNullable<ReturnType<typeof useJournalList>["data"]>;
export type JournalEntry = components["schemas"]["JournalEvent"];
export type Proposal = components["schemas"]["Proposal"];
export type Actor = components["schemas"]["Actor"];
export type Healthz = components["schemas"]["Healthz"];
export type Session = components["schemas"]["SessionResponse"];
