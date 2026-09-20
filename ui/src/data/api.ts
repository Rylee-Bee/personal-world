/**
 * PROJECT WORLDS — Typed API Client
 *
 * Uses openapi-fetch with generated types from the OpenAPI spec.
 * All API calls are type-checked at build time.
 */

import createClient from "openapi-fetch";
import type { paths } from "../generated/api-types";

const API_BASE = import.meta.env.VITE_API_URL || "";

export const api = createClient<paths>({
  baseUrl: API_BASE,
});

// Auth token management
function clearAuthToken(): void {
  localStorage.removeItem("pw_token");
}

// Step-up auth header
async function withStepUp<T>(fn: () => Promise<T>): Promise<T> {
  // Try the request first — if 403 with step-up required, prompt and retry
  try {
    return await fn();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    if (error.status === 403) {
      // TODO: Show step-up prompt UI (T8 StepUpPrompt component)
      throw err;
    }
    throw err;
  }
}

// Error types
export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string;

  constructor(status: number, message: string, code?: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

// Typed response helper
async function unwrap<T>(promise: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await promise;

  if (error) {
    const errObj = error as { message?: string; code?: string; detail?: string };
    throw new ApiError(
      response.status,
      errObj.message || `HTTP ${response.status}`,
      errObj.code,
      errObj.detail
    );
  }

  if (response.status === 401) {
    clearAuthToken();
    window.location.href = "/login";
    throw new ApiError(401, "Unauthorized — redirecting to login");
  }

  if (response.status === 503) {
    throw new ApiError(503, "Service unavailable", "service_unavailable");
  }

  return data as T;
}

// ===== Typed API functions =====

// Health
export const healthz = () =>
  unwrap(api.GET("/healthz", {}));

// Setup
export const getSetupStatus = () =>
  unwrap(api.GET("/api/setup/status", {}));

// World
export const getStatus = () =>
  unwrap(api.GET("/api/status", {}));

export const getDaily = () =>
  unwrap(api.GET("/api/daily", {}));

// Journal
export const listJournal = (params?: { limit?: number; offset?: number }) =>
  unwrap(api.GET("/api/journal", { params: { query: params } }));

export const writeJournal = (body: { content: string; kind?: string; metadata?: Record<string, never> }) =>
  unwrap(api.POST("/api/journal", { body: { ...body, kind: body.kind ?? "entry" } }));

export const supersedeJournal = (body: { entry_id: string; reason: string }) =>
  unwrap(api.POST("/api/journal/supersede", { body }));

export const journalHistory = (params?: { limit?: number }) =>
  unwrap(api.GET("/api/journal/history", { params: { query: params } }));

export const journalAudit = () =>
  unwrap(api.GET("/api/journal/audit", {}));

// Chat
export const sendChat = (body: { message: string; provider?: string; context?: Record<string, never> }) =>
  unwrap(withStepUp(() => api.POST("/api/chat", { body })));

export const listChatProviders = () =>
  unwrap(api.GET("/api/chat/providers", {}));

export const chatHistory = (params?: { limit?: number }) =>
  unwrap(api.GET("/api/chat/history", { params: { query: params } }));

// Proposals
export const listProposals = () =>
  unwrap(api.GET("/api/proposals", {}));

export const getProposal = (id: string) =>
  unwrap(api.GET("/api/proposals/{proposal_id}", { params: { path: { proposal_id: id } } }));

export const approveProposal = (id: string) =>
  unwrap(withStepUp(() => api.POST("/api/proposals/{proposal_id}/approve", { params: { path: { proposal_id: id } } })));

export const rejectProposal = (id: string) =>
  unwrap(withStepUp(() => api.POST("/api/proposals/{proposal_id}/reject", { params: { path: { proposal_id: id } } })));

export const executeProposal = (id: string) =>
  unwrap(api.POST("/api/proposals/{proposal_id}/execute", { params: { path: { proposal_id: id } } }));

// Actors
export const listActors = () =>
  unwrap(api.GET("/api/actors", {}));

// Manifest
export const getManifest = () =>
  unwrap(api.GET("/api/manifest", {}));

// Brain
export const listBrainTemplates = () =>
  unwrap(api.GET("/api/brain/templates", {}));

// Memory
export const searchMemory = (q: string, limit?: number) =>
  unwrap(api.GET("/api/memory/search", { params: { query: { q, limit } } }));

// Tools
export const listTools = () =>
  unwrap(api.GET("/api/tools", {}));

// Auth
export const login = (token: string) =>
  unwrap(api.POST("/api/auth/login", { body: { token } }));

export const logout = () =>
  unwrap(api.POST("/api/auth/logout", {}));

export const getSession = () =>
  unwrap(api.GET("/api/auth/session", {}));

// Re-export types
export type { paths } from "../generated/api-types";
export type { components } from "../generated/api-types";
