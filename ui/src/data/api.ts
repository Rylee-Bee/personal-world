/**
 * PROJECT WORLDS — Typed API Client
 *
 * Uses openapi-fetch with generated types from the OpenAPI spec.
 * All API calls are type-checked at build time.
 *
 * Every successful (HTTP 2xx) body below carries the server's own
 * envelope (`{ok, status, data, warnings}` where applicable); the
 * envelope is data, not an HTTP error, and is preserved untouched for
 * hooks and screens to interpret honestly.
 */

import createClient from "openapi-fetch";
import type { components, paths } from "../generated/api-types";

type Schemas = components["schemas"];

const API_BASE = import.meta.env.VITE_API_URL || "";

export const api = createClient<paths>({
  baseUrl: API_BASE,
});

// Auth token management
function clearAuthToken(): void {
  localStorage.removeItem("pw_token");
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

/** The subset of a parsed failure body the FastAPI server actually sends. */
interface ErrorBody {
  detail?: unknown;
  message?: unknown;
  code?: unknown;
  warnings?: unknown;
}

function bodyText(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.length > 0);
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

/**
 * Typed response helper.
 *
 * An HTTP failure (declared error code OR any other non-2xx status —
 * FastAPI's 401/403/404/409/422 all arrive this way) must throw; a
 * silent `undefined` here is how a 404 once rendered as "Online".
 */
async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;

  if (response.status === 401) {
    clearAuthToken();
    window.location.href = "/login";
    throw new ApiError(401, "Unauthorized — redirecting to login");
  }

  if (response.status === 503) {
    throw new ApiError(503, "Service unavailable", "service_unavailable");
  }

  if (error !== undefined || !response.ok) {
    const errObj = (error ?? (await response.json().catch(() => undefined))) as
      | ErrorBody
      | undefined;
    throw new ApiError(
      response.status,
      // FastAPI HTTPException bodies arrive as {detail} — surface it so
      // error state is real, not a bare "HTTP 4xx". Envelope failures
      // additionally carry {warnings:[…]}.
      bodyText(errObj?.message) ??
        bodyText(errObj?.detail) ??
        bodyText(errObj?.warnings) ??
        `HTTP ${response.status}`,
      bodyText(errObj?.code),
      bodyText(errObj?.detail),
    );
  }

  if (data === undefined) {
    throw new ApiError(
      response.status,
      "The server answered without a body — cannot show unknown data as real.",
    );
  }

  return data;
}

// ===== Typed API functions =====

// Health
export const healthz = () => unwrap(api.GET("/healthz", {}));

// Setup
export const getSetupStatus = () => unwrap(api.GET("/api/setup/status", {}));

// World
export const getStatus = () => unwrap(api.GET("/api/status", {}));

export const getDaily = () => unwrap(api.GET("/api/daily", {}));

// Journal — server contract: {ok, data:[JournalEvent…]} current-events
// list (query `n`, clamped 1..500 server-side); writes are {text};
// supersede is {supersedes: ts, text, reason?}; history is one chain by ts.
export const listJournal = (params?: { n?: number }) =>
  unwrap(api.GET("/api/journal", { params: { query: params } }));

export const writeJournal = (body: Schemas["JournalNoteRequest"]) =>
  unwrap(api.POST("/api/journal", { body }));

export const supersedeJournal = (body: Schemas["JournalSupersedeRequest"]) =>
  unwrap(api.POST("/api/journal/supersede", { body }));

export const journalHistory = (params: { ts: string }) =>
  unwrap(api.GET("/api/journal/history", { params: { query: params } }));

export const journalAudit = () => unwrap(api.GET("/api/journal/audit", {}));

// Chat — the server picks the reasoning provider (no per-request
// provider field). An unconfigured provider answers 200 + ok:false;
// screens must read the envelope, not just the HTTP status.
export const sendChat = (body: Schemas["ChatRequest"]) =>
  unwrap(api.POST("/api/chat", { body }));

export const listChatProviders = () =>
  unwrap(api.GET("/api/chat/providers", {}));

export const chatHistory = (params?: { n?: number }) =>
  unwrap(api.GET("/api/chat/history", { params: { query: params } }));

// Proposals
export const listProposals = () => unwrap(api.GET("/api/proposals", {}));

export const getProposal = (id: string) =>
  unwrap(
    api.GET("/api/proposals/{proposal_id}", { params: { path: { proposal_id: id } } }),
  );

export const approveProposal = (id: string) =>
  unwrap(
    api.POST("/api/proposals/{proposal_id}/approve", {
      params: { path: { proposal_id: id } },
    }),
  );

export const rejectProposal = (id: string) =>
  unwrap(
    api.POST("/api/proposals/{proposal_id}/reject", {
      params: { path: { proposal_id: id } },
    }),
  );

export const executeProposal = (id: string) =>
  unwrap(
    api.POST("/api/proposals/{proposal_id}/execute", {
      params: { path: { proposal_id: id } },
    }),
  );

// Actors — {ok, data: Actor[]}: staff directory of connected PROVIDERS.
export const listActors = () => unwrap(api.GET("/api/actors", {}));

// Manifest
export const getManifest = () => unwrap(api.GET("/api/manifest", {}));

// Brain
export const listBrainTemplates = () =>
  unwrap(api.GET("/api/brain/templates", {}));

// Memory
export const searchMemory = (q: string, limit?: number) =>
  unwrap(api.GET("/api/memory/search", { params: { query: { q, limit } } }));

// Tools
export const listTools = () => unwrap(api.GET("/api/tools", {}));

// Auth
export const login = (token: string) =>
  unwrap(api.POST("/api/auth/login", { body: { token } }));

export const logout = () => unwrap(api.POST("/api/auth/logout", {}));

export const getSession = () => unwrap(api.GET("/api/auth/session", {}));

// Re-export types
export type { paths } from "../generated/api-types";
export type { components } from "../generated/api-types";

// ===== Vault =====
export const getVaultStatus = () => unwrap(api.GET("/api/vault/status", {}));

export const unlockVault = (passphrase: string) =>
  unwrap(api.POST("/api/vault/unlock", { body: { passphrase } }));

export const lockVault = () => unwrap(api.POST("/api/vault/lock", {}));

export const listVaultNames = () => unwrap(api.GET("/api/vault/names", {}));

export const setVaultSecret = (name: string, value: string) =>
  unwrap(api.POST("/api/vault/set", { body: { name, value } }));

export const getVaultSecret = (name: string) =>
  unwrap(api.GET("/api/vault/{name}", { params: { path: { name } } }));

export const deleteVaultSecret = (name: string) =>
  unwrap(api.DELETE("/api/vault/{name}", { params: { path: { name } } }));

// ===== Prefs =====
export const getPrefs = () => unwrap(api.GET("/api/prefs", {}));

export const putPrefs = (body: Schemas["PrefsUpdateRequest"]) =>
  unwrap(api.PUT("/api/prefs", { body }));

export const getPrefsSchema = () => unwrap(api.GET("/api/prefs/schema", {}));

// ===== Sections =====
// GET answers {ok, data:{schema, sections}}; PUT accepts the layout
// delta {order?, hidden?} of server-known section ids.
export const getSections = () => unwrap(api.GET("/api/sections", {}));

export const putSections = (body: Schemas["SectionsUpdateRequest"]) =>
  unwrap(api.PUT("/api/sections", { body }));

// ===== Reminders =====
export const listReminders = () => unwrap(api.GET("/api/reminders", {}));

export const addReminder = (text: string) =>
  unwrap(api.POST("/api/reminders", { body: { text } }));

export const toggleReminder = (rid: string, enabled: boolean) =>
  unwrap(
    api.PATCH("/api/reminders/{rid}", { params: { path: { rid } }, body: { enabled } }),
  );

export const deleteReminder = (rid: string) =>
  unwrap(api.DELETE("/api/reminders/{rid}", { params: { path: { rid } } }));

// ===== Apps =====
export const listApps = () => unwrap(api.GET("/api/apps", {}));

export const putApps = (body: Schemas["AppsUpdateRequest"]) =>
  unwrap(api.PUT("/api/apps", { body }));

// ===== Themes =====
export const listThemes = () => unwrap(api.GET("/api/themes", {}));

export const getTheme = (name: string) =>
  unwrap(api.GET("/api/themes/{name}", { params: { path: { name } } }));

// ===== Connections =====
export const getConnectionSchemas = () =>
  unwrap(api.GET("/api/connections/schemas", {}));

export const getConnectionSchema = (capability: string) =>
  unwrap(
    api.GET("/api/connections/schema/{capability}", {
      params: { path: { capability } },
    }),
  );

export const getConnectionsConfig = () =>
  unwrap(api.GET("/api/connections/config", {}));

export const getConnectionsOverview = () =>
  unwrap(api.GET("/api/connections/overview", {}));

export const listConnections = () => unwrap(api.GET("/api/connections", {}));

export const saveConnection = (body: Schemas["ConnectionSaveRequest"]) =>
  unwrap(api.PUT("/api/connections", { body }));

export const deleteConnection = (name: string) =>
  unwrap(api.DELETE("/api/connections/{name}", { params: { path: { name } } }));

export const testConnection = (body: Schemas["ConnectionTestRequest"]) =>
  unwrap(api.POST("/api/connections/test", { body }));

export const validateConnection = (body: Schemas["ConnectionTestRequest"]) =>
  unwrap(api.POST("/api/connections/validate", { body }));

// ===== Identity =====
export const getPrincipal = () => unwrap(api.GET("/api/identity/principal", {}));

export const putPrincipal = (display_name: string) =>
  unwrap(api.PUT("/api/identity/principal", { body: { display_name } }));

export const listUsers = () => unwrap(api.GET("/api/identity/users", {}));

export const createUser = (body: Schemas["UserCreateRequest"]) =>
  unwrap(api.POST("/api/identity/users", { body }));

export const listAgents = () => unwrap(api.GET("/api/identity/agents", {}));

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
export const getMediaStatus = () => unwrap(api.GET("/api/media/status", {}));

export const getMediaLibrary = () => unwrap(api.GET("/api/media/library", {}));

export const getMediaRecent = () => unwrap(api.GET("/api/media/recent", {}));

export const getMediaActivity = () => unwrap(api.GET("/api/media/activity", {}));

export const searchMedia = (q: string) =>
  unwrap(api.GET("/api/media/search", { params: { query: { q } } }));

// ===== Endpoints the client does NOT call yet =====
// /api/projects/status, /api/source-control/*, /api/lab/*,
// /api/native-lab/*, /api/ingress/rollups, /api/updates,
// /api/exports/*, /api/reconciler/* exist on the server but are not
// part of the generated spec snapshot and have no typed wrapper here.
// Adding them means regenerating src/generated/openapi.json from the
// server contract — not hand-writing a wrapper against an unknown
// shape.
