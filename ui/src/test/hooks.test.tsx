/**
 * Tests for src/data/hooks.ts — React Query hooks.
 *
 * Mocks the API layer and wraps rendered components in QueryClientProvider.
 * Uses React Testing Library to verify hooks render and return correct states.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock the API module ──────────────────────────────────────────────
vi.mock("../data/api", () => ({
  healthz: vi.fn(),
  getStatus: vi.fn(),
  getDaily: vi.fn(),
  getSetupStatus: vi.fn(),
  listJournal: vi.fn(),
  writeJournal: vi.fn(),
  supersedeJournal: vi.fn(),
  journalHistory: vi.fn(),
  listChatProviders: vi.fn(),
  sendChat: vi.fn(),
  chatHistory: vi.fn(),
  listProposals: vi.fn(),
  getProposal: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
  listActors: vi.fn(),
  getManifest: vi.fn(),
  searchMemory: vi.fn(),
  listBrainTemplates: vi.fn(),
  listTools: vi.fn(),
  getSession: vi.fn(),
  getVaultStatus: vi.fn(),
  listVaultNames: vi.fn(),
  getVaultSecret: vi.fn(),
  unlockVault: vi.fn(),
  lockVault: vi.fn(),
  setVaultSecret: vi.fn(),
  deleteVaultSecret: vi.fn(),
  getPrefs: vi.fn(),
  putPrefs: vi.fn(),
  getPrefsSchema: vi.fn(),
  getSections: vi.fn(),
  putSections: vi.fn(),
  listReminders: vi.fn(),
  addReminder: vi.fn(),
  toggleReminder: vi.fn(),
  deleteReminder: vi.fn(),
  listApps: vi.fn(),
  listThemes: vi.fn(),
  getTheme: vi.fn(),
  getConnectionsOverview: vi.fn(),
  listConnections: vi.fn(),
  getConnectionSchemas: vi.fn(),
  saveConnection: vi.fn(),
  deleteConnection: vi.fn(),
  getPrincipal: vi.fn(),
  putPrincipal: vi.fn(),
  listUsers: vi.fn(),
  listAgents: vi.fn(),
  getDiscoveryStatus: vi.fn(),
  listDiscoverySources: vi.fn(),
  listDiscoveryInterests: vi.fn(),
  getMediaStatus: vi.fn(),
  getMediaLibrary: vi.fn(),
  getMediaRecent: vi.fn(),
  getMediaActivity: vi.fn(),
}));

import {
  useTodaySummary,
  useJournalList,
  queryKeys,
} from "../data/hooks";
import type { components } from "../generated/api-types";
import * as api from "../data/api";

// ── Helpers ──────────────────────────────────────────────────────────
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = makeQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper: Wrapper, queryClient };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useTodaySummary", () => {
    it("returns loading state initially", () => {
      vi.mocked(api.getStatus).mockReturnValue(new Promise(() => {}));
      vi.mocked(api.getDaily).mockReturnValue(new Promise(() => {}));
      vi.mocked(api.listActors).mockReturnValue(new Promise(() => {}));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTodaySummary(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("returns data once all queries resolve", async () => {
      vi.mocked(api.getStatus).mockResolvedValue({
        world: { facts: 3 },
        capabilities: { journal: { ok: true, status: "healthy" } },
      } as Awaited<ReturnType<typeof api.getStatus>>);

      vi.mocked(api.getDaily).mockResolvedValue({
        reminders: [{ text: "Read a book" }],
      } as Awaited<ReturnType<typeof api.getDaily>>);

      vi.mocked(api.listActors).mockResolvedValue({
        actors: [{ id: "renai", name: "Renai", current_state: "rest" }],
      } as Awaited<ReturnType<typeof api.listActors>>);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTodaySummary(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.greeting).toBeDefined();
      expect(result.current.data!.capabilities).toHaveLength(1);
      expect(result.current.data!.signals).toHaveLength(1);
    });
  });

  describe("useJournalList", () => {
    it("returns data after fetch", async () => {
      const mockEntries: components["schemas"]["JournalEvent"][] = [
        { id: "e1", kind: "entry", content: "Test entry", timestamp: "2026-09-19T12:00:00Z" },
      ];
      vi.mocked(api.listJournal).mockResolvedValue({
        entries: mockEntries,
        total: 1,
      } as Awaited<ReturnType<typeof api.listJournal>>);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useJournalList(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.entries).toHaveLength(1);
      expect(result.current.data!.entries![0].id).toBe("e1");
    });
  });

  describe("queryKeys", () => {
    it("uses correct key arrays for stable keys", () => {
      expect(queryKeys.healthz).toEqual(["healthz"]);
      expect(queryKeys.status).toEqual(["status"]);
      expect(queryKeys.daily).toEqual(["daily"]);
      expect(queryKeys.journal).toEqual(["journal"]);
      expect(queryKeys.journalHistory).toEqual(["journal", "history"]);
      expect(queryKeys.chatProviders).toEqual(["chat", "providers"]);
      expect(queryKeys.chatHistory).toEqual(["chat", "history"]);
      expect(queryKeys.proposals).toEqual(["proposals"]);
      expect(queryKeys.actors).toEqual(["actors"]);
      expect(queryKeys.manifest).toEqual(["manifest"]);
      expect(queryKeys.brainTemplates).toEqual(["brain", "templates"]);
      expect(queryKeys.tools).toEqual(["tools"]);
      expect(queryKeys.session).toEqual(["session"]);
      expect(queryKeys.setup).toEqual(["setup"]);
    });

    it("uses parameterised keys correctly", () => {
      expect(queryKeys.proposal("abc-123")).toEqual(["proposals", "abc-123"]);
      expect(queryKeys.memory("hello")).toEqual(["memory", "hello"]);
    });

    it("journal key with params extends base", () => {
      const base = queryKeys.journal;
      const withParams = [...base, { limit: 5 }];
      expect(withParams).toEqual(["journal", { limit: 5 }]);
    });
  });
});
