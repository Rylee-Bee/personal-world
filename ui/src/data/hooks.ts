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
} from "./api";
import type { components } from "../generated/api-types";

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

// ===== Today Summary (composed) =====
export function useTodaySummary() {
  const status = useStatus();
  const daily = useDaily();
  const actors = useActors();

  const isLoading = status.isLoading || daily.isLoading || actors.isLoading;
  const error = status.error || daily.error || actors.error;

  if (isLoading || error || !status.data || !daily.data) {
    return { data: undefined, isLoading, error };
  }

  const capabilities = Object.entries(status.data.capabilities || {}).map(
    ([id, cap]) => ({
      id,
      name: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      status: (cap as { status?: string }).status || "unknown",
      summary: (cap as { warnings?: string[] }).warnings?.[0],
    })
  );

  const signals = (daily.data.reminders || []).slice(0, 3).map(
    (r: Record<string, unknown>, i: number) => ({
      id: `reminder-${i}`,
      level: "info" as const,
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
