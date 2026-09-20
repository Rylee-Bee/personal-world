/**
 * Tests for src/data/api.ts — typed API client.
 *
 * Mocks openapi-fetch so the api client uses a fake GET/POST.
 * Tests the public API functions and the unwrap error paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock openapi-fetch (vi.hoisted so references are available inside vi.mock) ──
const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    POST: mockPost,
  }),
}));

// Mock localStorage / window.location used by clearAuthToken inside unwrap
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
  });
  vi.clearAllMocks();
});

// Import after mocks are in place
import {
  healthz,
  getStatus,
  listJournal,
  sendChat,
  ApiError,
} from "../data/api";

// ── Helpers ──────────────────────────────────────────────────────────
function okResponse<T>(data: T) {
  return {
    data,
    error: undefined,
    response: { status: 200, ok: true } as Response,
  };
}

function errResponse(status: number, error?: unknown) {
  return {
    data: undefined,
    error: error ?? { message: `HTTP ${status}` },
    response: { status, ok: status >= 200 && status < 300 } as Response,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("api client", () => {
  describe("healthz()", () => {
    it("returns health data on success", async () => {
      const healthData = { ok: true, auth_configured: true };
      mockGet.mockResolvedValueOnce(okResponse(healthData));

      const result = await healthz();

      expect(mockGet).toHaveBeenCalledWith("/healthz", {});
      expect(result).toEqual(healthData);
    });
  });

  describe("getStatus()", () => {
    it("returns world status", async () => {
      const statusData = {
        world: { facts: 5, intents: 2 },
        capabilities: { source_control: { ok: true, status: "healthy" } },
      };
      mockGet.mockResolvedValueOnce(okResponse(statusData));

      const result = await getStatus();

      expect(mockGet).toHaveBeenCalledWith("/api/status", {});
      expect(result).toEqual(statusData);
    });
  });

  describe("listJournal()", () => {
    it("returns journal entries", async () => {
      const journalData = {
        entries: [
          { id: "1", kind: "entry", content: "hello", timestamp: "2026-01-01T00:00:00Z" },
        ],
        total: 1,
      };
      mockGet.mockResolvedValueOnce(okResponse(journalData));

      const result = await listJournal({ limit: 10 });

      expect(mockGet).toHaveBeenCalledWith("/api/journal", {
        params: { query: { limit: 10 } },
      });
      expect(result.entries).toHaveLength(1);
    });
  });

  describe("sendChat()", () => {
    it("sends a chat message via POST", async () => {
      const chatResponse = { reply: "Hello!", provider: "openai" };
      mockPost.mockResolvedValueOnce(okResponse(chatResponse));

      const result = await sendChat({ message: "Hi" });

      expect(mockPost).toHaveBeenCalledWith("/api/chat", {
        body: { message: "Hi" },
      });
      expect(result.reply).toBe("Hello!");
    });
  });

  describe("ApiError", () => {
    it("has the correct shape", () => {
      const err = new ApiError(418, "I'm a teapot", "teapot", "detail text");

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.name).toBe("ApiError");
      expect(err.status).toBe(418);
      expect(err.code).toBe("teapot");
      expect(err.detail).toBe("detail text");
      expect(err.message).toBe("I'm a teapot");
    });
  });

  describe("unwrap() error paths", () => {
    it("throws ApiError on 401 and clears auth token", async () => {
      mockGet.mockResolvedValue({
        data: undefined,
        error: undefined,
        response: { status: 401, ok: false } as Response,
      });

      try {
        await healthz();
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
      expect(localStorage.getItem("pw_token")).toBeNull();
    });

    it("throws ApiError on 503 with service_unavailable code", async () => {
      mockGet.mockResolvedValue({
        data: undefined,
        error: undefined,
        response: { status: 503, ok: false } as Response,
      });

      try {
        await getStatus();
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(503);
        expect((err as ApiError).code).toBe("service_unavailable");
      }
    });
  });
});
