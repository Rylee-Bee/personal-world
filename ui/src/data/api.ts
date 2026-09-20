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

// ===== Vault =====
export const getVaultStatus = () =>
  unwrap(api.GET("/api/vault/status", {}));

export const unlockVault = (passphrase: string) =>
  unwrap(withStepUp(() => api.POST("/api/vault/unlock", { body: { passphrase } })));

export const lockVault = () =>
  unwrap(withStepUp(() => api.POST("/api/vault/lock", {})));

export const listVaultNames = () =>
  unwrap(api.GET("/api/vault/names", {}));

export const setVaultSecret = (name: string, value: string) =>
  unwrap(withStepUp(() => api.POST("/api/vault/set", { body: { name, value } })));

export const getVaultSecret = (name: string) =>
  unwrap(api.GET("/api/vault/{name}", { params: { path: { name } } }));

export const deleteVaultSecret = (name: string) =>
  unwrap(withStepUp(() => api.DELETE("/api/vault/{name}", { params: { path: { name } } })));

// ===== Prefs =====
export const getPrefs = () =>
  unwrap(api.GET("/api/prefs", {}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const putPrefs = (body: any) =>
  unwrap(withStepUp(() => api.PUT("/api/prefs", { body })));

export const getPrefsSchema = () =>
  unwrap(api.GET("/api/prefs/schema", {}));

// ===== Sections =====
export const getSections = () =>
  unwrap(api.GET("/api/sections", {}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const putSections = (body: any) =>
  unwrap(withStepUp(() => api.PUT("/api/sections", { body })));

// ===== Reminders =====
export const listReminders = () =>
  unwrap(api.GET("/api/reminders", {}));

export const addReminder = (text: string) =>
  unwrap(withStepUp(() => api.POST("/api/reminders", { body: { text } })));

export const toggleReminder = (rid: string, enabled: boolean) =>
  unwrap(withStepUp(() => api.PATCH("/api/reminders/{rid}", { params: { path: { rid } }, body: { enabled } })));

export const deleteReminder = (rid: string) =>
  unwrap(withStepUp(() => api.DELETE("/api/reminders/{rid}", { params: { path: { rid } } })));

// ===== Apps =====
export const listApps = () =>
  unwrap(api.GET("/api/apps", {}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const putApps = (body: any) =>
  unwrap(withStepUp(() => api.PUT("/api/apps", { body })));

// ===== Themes =====
export const listThemes = () =>
  unwrap(api.GET("/api/themes", {}));

export const getTheme = (name: string) =>
  unwrap(api.GET("/api/themes/{name}", { params: { path: { name } } }));

// ===== Connections =====
export const getConnectionSchemas = () =>
  unwrap(api.GET("/api/connections/schemas", {}));

export const getConnectionSchema = (capability: string) =>
  unwrap(api.GET("/api/connections/schema/{capability}", { params: { path: { capability } } }));

export const getConnectionsConfig = () =>
  unwrap(api.GET("/api/connections/config", {}));

export const getConnectionsOverview = () =>
  unwrap(api.GET("/api/connections/overview", {}));

export const listConnections = () =>
  unwrap(api.GET("/api/connections", {}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const saveConnection = (body: any) =>
  unwrap(withStepUp(() => api.PUT("/api/connections", { body })));

export const deleteConnection = (name: string) =>
  unwrap(withStepUp(() => api.DELETE("/api/connections/{name}", { params: { path: { name } } })));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const testConnection = (body: any) =>
  unwrap(api.POST("/api/connections/test", { body }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateConnection = (body: any) =>
  unwrap(api.POST("/api/connections/validate", { body }));

// ===== Identity =====
export const getPrincipal = () =>
  unwrap(api.GET("/api/identity/principal", {}));

export const putPrincipal = (display_name: string) =>
  unwrap(withStepUp(() => api.PUT("/api/identity/principal", { body: { display_name } })));

export const listUsers = () =>
  unwrap(api.GET("/api/identity/users", {}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createUser = (body: any) =>
  unwrap(withStepUp(() => api.POST("/api/identity/users", { body })));

export const listAgents = () =>
  unwrap(api.GET("/api/identity/agents", {}));

// ===== Discovery =====
export const getDiscoveryStatus = () =>
  unwrap(api.GET("/api/discovery/status", {}));

export const listDiscoverySources = () =>
  unwrap(api.GET("/api/discovery/sources", {}));

export const listDiscoveryInterests = () =>
  unwrap(api.GET("/api/discovery/interests", {}));

export const triggerDiscovery = () =>
  unwrap(api.GET("/api/discovery/discover", {}));

// ===== Media =====
export const getMediaStatus = () =>
  unwrap(api.GET("/api/media/status", {}));

export const getMediaLibrary = () =>
  unwrap(api.GET("/api/media/library", {}));

export const getMediaRecent = () =>
  unwrap(api.GET("/api/media/recent", {}));

export const getMediaActivity = () =>
  unwrap(api.GET("/api/media/activity", {}));

export const searchMedia = (q: string) =>
  unwrap(api.GET("/api/media/search", { params: { query: { q } } }));

// ===== Projects =====
// TODO: add /api/projects/status to openapi.json
// export const getProjectsStatus = () =>
//   unwrap(api.GET("/api/projects/status", {}));

// ===== Source Control =====
// TODO: add /api/source-control/* to openapi.json
// export const getSourceControlStatus = () =>
//   unwrap(api.GET("/api/source-control/status", {}));

// ===== Lab =====
// TODO: add /api/lab/* and /api/native-lab/* to openapi.json
// export const getLabState = () =>
//   unwrap(api.GET("/api/lab/state", {}));

// ===== Ingress =====
// TODO: add /api/ingress/rollups to openapi.json
// export const getIngressRollups = () =>
//   unwrap(api.GET("/api/ingress/rollups", {}));

// ===== Updates =====
// TODO: add /api/updates to openapi.json
// export const getUpdates = () =>
//   unwrap(api.GET("/api/updates", {}));

// ===== Exports =====
// TODO: add /api/exports/* to openapi.json
// export const exportSettings = () =>
//   unwrap(api.GET("/api/exports/settings", {}));

// ===== Reconciler =====
// TODO: add /api/reconciler/* to openapi.json
// export const getReconcilerStatus = () =>
//   unwrap(api.GET("/api/reconciler/status", {}));
