/**
 * PROJECT WORLDS — React Query Hooks
 *
 * Typed data-fetching hooks using openapi-fetch + TanStack Query.
 * Every hook is backed by the generated API client.
 *
 * Envelope discipline: the Station server answers 200 with a
 * `{ok:false, status, warnings}` body for soft failures (step-up not
 * granted, no provider configured, unknown journal ts). Hooks that
 * own such endpoints convert ok:false into a thrown Error here, so
 * screens render real failure states instead of "success with holes".
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  healthz,
  getStatus,
  getDaily,
  listJournal,
  getJournalLast,
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
  listRecordCategories,
  listRecords,
  writeRecord,
  pinRecord,
  unpinRecord,
  deleteRecord,
  stepUp,
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
import type {
  Actor,
  ChatHistoryEntry,
  Envelope,
  HealthzResponse,
  JournalEvent,
  SessionData,
} from "./contract";
import type {
  CapabilitySummary,
  Resident,
  TodaySummary,
  WorldSignal,
} from "./types";
import {
  capabilityDisplayName,
  COMPANION_RESIDENTS,
  plainAttention,
  toCapabilityStatus,
} from "./types";

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
  prefs: ["prefs"] as const,
  records: ["records"] as const,
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
/** Current events (each supersede chain's newest version), newest first. */
export function useJournalList(params?: { n?: number }) {
  return useQuery({
    queryKey: [...queryKeys.journal, params],
    queryFn: () => listJournal(params),
  });
}

/** GET /api/journal/last — the newest CURRENT entry (the calm-view
 * tail), or an honest `entry: null`. The read-only deep-link contract
 * for the daily home loop's "Resume — yesterday's thread" beat
 * (TRUE-NORTH): deterministic with every model off, person-only,
 * caller-scoped. Consumers link into Memory; this never mutates. */
export function useJournalLast() {
  return useQuery({
    queryKey: [...queryKeys.journal, "last"],
    queryFn: getJournalLast,
    staleTime: 60_000,
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
    mutationFn: async (body: Parameters<typeof supersedeJournal>[0]) => {
      const res = await supersedeJournal(body);
      // The server reports "no entry found" / conflicts as 200 + ok:false.
      if (res.ok === false) {
        throw new Error(res.warnings?.[0] || res.status || "Supersede failed");
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.journal });
    },
  });
}

/** The full correction chain for ONE entry (oldest → newest, with reasons). */
export function useJournalChain(ts: string | null) {
  return useQuery({
    queryKey: [...queryKeys.journalHistory, ts],
    queryFn: async () => {
      if (ts === null) return [];
      const res = await journalHistory({ ts });
      if (res.ok === false) {
        throw new Error(res.warnings?.[0] || res.status || "History unavailable");
      }
      return res.data?.entries ?? [];
    },
    enabled: ts !== null,
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
    mutationFn: async (body: Parameters<typeof sendChat>[0]) => {
      const res = await sendChat(body);
      // No reasoning provider configured: HTTP 200 + ok:false + warnings.
      if (res.ok === false) {
        throw new Error(
          res.warnings?.[0] || "Chat is not configured on this station yet.",
        );
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.chatHistory });
    },
  });
}

export function useChatHistory(n?: number) {
  return useQuery({
    queryKey: [...queryKeys.chatHistory, n],
    queryFn: () => chatHistory({ n }),
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
/** {ok, data: Actor[]} — the staff directory of connected PROVIDERS. */
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

// ===== Records (structured person data inside Memory) =====
//
// Contract: docs/RECORDS-API.md. Reads answer person-authenticated;
// the 409 "locked" refusal on a locked-category read PROPAGATES as an
// ApiError (query error state) so the panel can render the step-up
// invitation — it is never flattened into a fake success. The
// degraded no-provider state is a 200 + ok:false envelope: that is
// data, and screens read it honestly.

/** Names + counts + locked flags for every category (contents never
 * included — a locked category is still listed so a person knows
 * what to unlock). */
export function useRecordCategories() {
  return useQuery({
    queryKey: [...queryKeys.records, "categories"],
    queryFn: listRecordCategories,
  });
}

/** One category's records. The 409 locked refusal arrives as an error
 * (isLockedRefusal) — by design, not by accident. */
export function useRecordsInCategory(category: string | null) {
  return useQuery({
    queryKey: [...queryKeys.records, "category", category],
    queryFn: () => listRecords({ category: category ?? undefined }),
    enabled: category !== null && category !== "",
  });
}

/** GET /api/records?q= — the deterministic lexical find (G-memory:
 * works with every model off; docs/RECORDS-API.md §Find). Shares the
 * records query-key namespace so writes/step-up invalidate it too.
 * Locked categories only appear behind a server-verified step-up —
 * fail closed, never a client-trusted flag. */
export function useRecordSearch(q: string) {
  return useQuery({
    queryKey: [...queryKeys.records, "search", q],
    queryFn: () => listRecords({ q }),
    enabled: q.trim().length > 0,
    staleTime: 60_000,
  });
}

/** The Overview feed: pinned records across every UNLOCKED category. */
export function usePinnedRecords() {
  return useQuery({
    queryKey: [...queryKeys.records, "pinned"],
    queryFn: () => listRecords({ pinned: true }),
    staleTime: 60_000,
  });
}

/** Records actions answer 200 with `{ok:false, status:"not_found"|
 *  "unavailable", warnings}` on refusal — throw, never render holes. */
async function recordsAction<
  T extends { ok?: boolean; status?: string; warnings?: string[] },
>(fn: () => Promise<T>, fallback: string): Promise<T> {
  const res = await fn();
  if (res.ok === false) {
    throw new Error(res.warnings?.[0] || res.status || fallback);
  }
  return res;
}

function invalidateRecords(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.records });
}

/** Create (no id) or update (id). Step-up gated: a 403 surfaces as an
 * ApiError the panel turns into the honest "elevate first" notice. */
export function useWriteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof writeRecord>[0]) =>
      recordsAction(() => writeRecord(body), "Could not save the record"),
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useSetRecordPinned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      category,
      id,
      pinned,
    }: { category: string; id: string; pinned: boolean }) =>
      recordsAction(
        () =>
          pinned
            ? pinRecord({ category, id })
            : unpinRecord({ category, id }),
        pinned ? "Could not pin the record" : "Could not unpin the record",
      ),
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ category, id }: { category: string; id: string }) =>
      recordsAction(() => deleteRecord({ category, id }), "Could not delete the record"),
    onSuccess: () => invalidateRecords(qc),
  });
}

/** POST /api/auth/step-up — the credential event that mints the
 * grant every Records write consumes. On success the session query
 * re-reads so lock states visibly update. */
export function useStepUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => stepUp(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.session });
      invalidateRecords(qc);
    },
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
// Backend contract (src/personal_world/api.py): every vault response
// is an `{ok, data}` envelope and there is NO secret_count on status —
// the count is derived from the names list.

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

/** Vault actions answer 200 with `{ok:false, status, warnings}` on refusal. */
async function vaultAction<
  T extends { ok?: boolean; status?: string; warnings?: string[] },
>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  if (res.ok === false) {
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
    queryKey: queryKeys.prefs,
    queryFn: getPrefs,
  });
}

export function usePutPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putPrefs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prefs });
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

// ===== Today Summary (composed) =====
//
// Composition inputs, all server-truth envelopes:
//   GET /api/status  → {ok, status, data:{capabilities, actors, …}}
//   GET /api/daily   → {ok, status, …, data:{world, capabilities, attention}}
//   GET /api/actors  → {ok, data: Actor[]}  (provider staff directory)
//   GET /api/prefs   → {ok, data:{companion, …}}  (names the resident)

export function useTodaySummary(): {
  data: TodaySummary | undefined;
  isLoading: boolean;
  error: Error | undefined;
} {
  const status = useStatus();
  const daily = useDaily();
  const prefs = usePrefs();

  const isLoading = status.isLoading || daily.isLoading || prefs.isLoading;
  const error = status.error ?? daily.error ?? prefs.error ?? undefined;

  if (isLoading || error || !status.data?.data || !daily.data?.data) {
    return { data: undefined, isLoading, error };
  }

  const capabilities: CapabilitySummary[] = Object.entries(
    status.data.data.capabilities ?? {},
  ).map(([id, cap]) => ({
    id,
    name: capabilityDisplayName(id),
    // Wire status is the server Status vocabulary; anything unseen
    // degrades to "unknown" at this boundary (never cast).
    status: toCapabilityStatus(cap.status),
    summary: cap.warnings?.[0],
  }));

  // Signals: the daily digest's attention list — plain strings the
  // loop deemed worth surfacing. Not alarms: "A small update".
  // (WorldSignalLevel has no "info" tier; adding one would touch
  // labels + styles without a real urgency difference.)
  // The raw "id: status" wire strings are translated to human
  // sentences by plainAttention (src/data/types.ts); the exact wire
  // string stays reachable behind the card's detail disclosure.
  const signals: WorldSignal[] = (daily.data.data.attention ?? [])
    .slice(0, 3)
    .map((text, i) => {
      const plain = plainAttention(text);
      return {
        id: `attention-${i}`,
        level: "update" as const,
        title: plain.headline,
        technical: plain.technical,
      };
    });

  const companion = prefs.data?.data?.companion;
  const resident: Resident | undefined = companion
    ? COMPANION_RESIDENTS[companion]
    : undefined;

  return {
    data: {
      greeting: getGreeting(),
      resident,
      capabilities,
      signals,
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
// Shapes come from src/data/contract.ts (verified against the live
// handlers — see that file's header for why not the generated types).
export type WorldStatus = NonNullable<ReturnType<typeof useStatus>["data"]>;
export type DailyDigest = NonNullable<ReturnType<typeof useDaily>["data"]>;
export type JournalList = NonNullable<ReturnType<typeof useJournalList>["data"]>;
export type JournalEntry = JournalEvent;
export type ChatEntry = ChatHistoryEntry;
export type Proposal = Envelope;
export type ProviderActor = Actor;
export type Healthz = HealthzResponse;
export type Session = Envelope<SessionData>;
