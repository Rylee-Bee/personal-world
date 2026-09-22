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
import type { JournalEvent } from "../data/contract";
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
      vi.mocked(api.getPrefs).mockReturnValue(new Promise(() => {}));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTodaySummary(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("returns data once all queries resolve", async () => {
      const observation = {
        ok: true,
        status: "healthy" as const,
        warnings: [],
        last_observed: "2026-09-20T09:00:00Z",
      };
      vi.mocked(api.getStatus).mockResolvedValue({
        ok: true,
        status: "healthy",
        data: {
          facts: 3,
          intents: 1,
          policies: 2,
          cemented_policies: 1,
          lore: { confirmed: 1, derived: 0, suggested: 0, ephemeral: 0 },
          declared_capabilities: 1,
          providers: 2,
          packs: 0,
          capabilities: { journal: observation },
          actors: [],
        },
      } as Awaited<ReturnType<typeof api.getStatus>>);

      vi.mocked(api.getDaily).mockResolvedValue({
        ok: true,
        status: "healthy",
        changed: false,
        warnings: [],
        actions: [],
        data: {
          world: {
            facts: 3,
            intents: 1,
            policies: 2,
            cemented_policies: 1,
            lore: { confirmed: 1, derived: 0, suggested: 0, ephemeral: 0 },
            declared_capabilities: 1,
            providers: 2,
            packs: 0,
          },
          capabilities: { journal: observation },
          attention: ["journal: stale digest"],
        },
      } as Awaited<ReturnType<typeof api.getDaily>>);

      vi.mocked(api.getPrefs).mockResolvedValue({
        ok: true,
        data: {
          motion: "reduced",
          contrast: "comfortable",
          text_scale: 1,
          density: "comfortable",
          target_size: 44,
          companion: "mermaid",
          accent: "world-keeper",
        },
      } as Awaited<ReturnType<typeof api.getPrefs>>);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTodaySummary(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.greeting).toBeDefined();
      expect(result.current.data!.capabilities).toHaveLength(1);
      expect(result.current.data!.capabilities[0].status).toBe("healthy");
      // The companion preference — not /api/actors — names the resident.
      expect(result.current.data!.resident?.name).toBe("Renai");
      // Attention strings become signals: the card carries plain
      // language, and the exact wire string stays as technical detail.
      expect(result.current.data!.signals).toHaveLength(1);
      expect(result.current.data!.signals[0].title).toBe("Journal: stale digest");
      expect(result.current.data!.signals[0].technical).toBe("journal: stale digest");
      expect(result.current.data!.signals[0].description).toBeUndefined();
    });

    it("never puts a raw 'id: status' token in a signal title", async () => {
      vi.mocked(api.getStatus).mockResolvedValue({
        ok: true,
        status: "healthy",
        data: {
          facts: 0,
          intents: 0,
          policies: 0,
          cemented_policies: 0,
          lore: { confirmed: 0, derived: 0, suggested: 0, ephemeral: 0 },
          declared_capabilities: 0,
          providers: 0,
          packs: 0,
          capabilities: {},
          actors: [],
        },
      } as Awaited<ReturnType<typeof api.getStatus>>);

      vi.mocked(api.getDaily).mockResolvedValue({
        ok: true,
        status: "healthy",
        changed: false,
        warnings: [],
        actions: [],
        data: {
          world: {
            facts: 0,
            intents: 0,
            policies: 0,
            cemented_policies: 0,
            lore: { confirmed: 0, derived: 0, suggested: 0, ephemeral: 0 },
            declared_capabilities: 0,
            providers: 0,
            packs: 0,
          },
          capabilities: {},
          attention: [
            "source_control: needs_attention",
            "reasoning: unavailable",
            "vault_backup: stale",
          ],
        },
      } as Awaited<ReturnType<typeof api.getDaily>>);

      vi.mocked(api.getPrefs).mockResolvedValue({
        ok: true,
        data: { companion: "mermaid" },
      } as Awaited<ReturnType<typeof api.getPrefs>>);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTodaySummary(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const signals = result.current.data!.signals;
      expect(signals.map((s) => s.title)).toEqual([
        "Source control needs your attention.",
        "The assistant is off — nothing depends on it.",
        "The latest word from Vault Backup is out of date.",
      ]);
      // No bare snake_case token survives on the visible line…
      for (const s of signals) {
        expect(s.title).not.toMatch(/[a-z]+_[a-z_]+/);
      }
      // …while the exact wire strings stay reachable as detail.
      expect(signals.map((s) => s.technical)).toEqual([
        "source_control: needs_attention",
        "reasoning: unavailable",
        "vault_backup: stale",
      ]);
    });
  });

  describe("useJournalList", () => {
    it("returns data after fetch", async () => {
      const mockEvents: JournalEvent[] = [
        {
          ts: "2026-09-19T12:00:00Z",
          kind: "observation",
          summary: "Test entry",
          provenance: {
            source: "user",
            observed_at: "2026-09-19T12:00:00Z",
            provider: null,
            authority: "observed",
          },
          classification: "private",
          supersedes: null,
          supersede_reason: null,
        },
      ];
      vi.mocked(api.listJournal).mockResolvedValue({
        ok: true,
        data: mockEvents,
      } as Awaited<ReturnType<typeof api.listJournal>>);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useJournalList(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.data).toHaveLength(1);
      expect(result.current.data!.data?.[0]?.ts).toBe("2026-09-19T12:00:00Z");
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
