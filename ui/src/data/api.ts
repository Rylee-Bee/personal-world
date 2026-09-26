/**
 * PROJECT WORLDS — Typed API Client
 *
 * Uses openapi-fetch with generated types from the OpenAPI spec plus
 * the live-contract DTOs in src/data/contract.ts (E7 reconciliation,
 * 2026-09-20): the shipped routes declare plain-dict responses and
 * read raw `request.json()`, so the generated contract types them
 * `{}` / no-body. Query and path parameters ARE declared and stay
 * generated-type-checked; response and body shapes come from
 * contract.ts, verified against the handlers.
 *
 * Every successful (HTTP 2xx) body below carries the server's own
 * envelope (`{ok, status, data, warnings}` where applicable); the
 * envelope is data, not an HTTP error, and is preserved untouched for
 * hooks and screens to interpret honestly.
 */

import createClient from "openapi-fetch";
import type { paths } from "../generated/api-types";
import type {
  Actor,
  AppsUpdateRequest,
  BrainTemplate,
  ChatHistoryData,
  ChatProvidersData,
  ChatRequest,
  ChatSendResponse,
  ConnectionSaveRequest,
  ConnectionTestRequest,
  DailyResponse,
  DiscoveryStatusData,
  Envelope,
  HealthzResponse,
  JournalAuditData,
  JournalDraftClearedData,
  JournalDraftData,
  JournalDraftPutRequest,
  JournalDraftSavedData,
  JournalEvent,
  JournalHistoryData,
  JournalLastData,
  JournalNoteData,
  JournalNoteRequest,
  JournalSupersedeRequest,
  LoginData,
  LoginRequest,
  ManifestResponse,
  PrincipalInfo,
  PrincipalPutRequest,
  Reminder,
  ReminderAddRequest,
  ReminderPatchRequest,
  RecordCategoriesData,
  RecordItem,
  RecordTargetRequest,
  RecordWriteRequest,
  RecordsListData,
  SectionsData,
  SectionsUpdateRequest,
  SessionData,
  SetupData,
  StepUpData,
  StepUpRequest,
  StatusData,
  UserCreateRequest,
  VaultNamesData,
  VaultSecretData,
  VaultSetRequest,
  VaultStatusData,
  VaultUnlockRequest,
  PrefsData,
  PrefsUpdateRequest,
  ProjectsStatusData,
  BridgeData,
  PlaceData,
  PlacePutRequest,
  RoomsEnvelope,
  RoomsResume,
  CrewEntry,
  RoomKeeper,
} from "./contract";

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

/** What openapi-fetch hands back for any route before unwrapping. */
interface FetchResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

/**
 * Typed response helper.
 *
 * An HTTP failure (declared error code OR any other non-2xx status —
 * FastAPI's 401/403/404/409/422 all arrive this way) must throw; a
 * silent `undefined` here is how a 404 once rendered as "Online".
 *
 * The one `as T` below is the deliberate single boundary of the data
 * layer: the generated contract types these bodies `{}`/`unknown`
 * because the server declares plain dicts, so the shape comes from
 * contract.ts (verified against the handlers), never from a cast at
 * a call-site.
 */
async function unwrap<T>(promise: Promise<FetchResult>): Promise<T> {
  const { data, error, response } = await promise;

  if (response.status === 401) {
    clearAuthToken();
    // Only the top frame may hijack navigation to /login. A nested frame
    // (Storybook's iframe) has no business replacing itself with the login
    // page — and an unmocked call there must surface as the thrown error
    // below, loudly, not as a dead iframe.
    if (window.top === window.self) window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
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

  return data as T;
}

/**
 * Body sender for routes whose handlers read raw `request.json()`.
 *
 * The generated contract types their `body` option as `undefined`
 * (no declared requestBody) while the server accepts the JSON body —
 * the mismatch is the E7 finding. openapi-fetch passes options through
 * to fetch untouched; this adapter keeps that ONE documented boundary
 * here instead of casting at every call-site. Runtime behavior is
 * identical to calling `api.POST(path, { body })` directly.
 */
function sendBody(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: object,
  params?: unknown,
): Promise<FetchResult> {
  const call = api[method] as (
    p: string,
    options: { body: unknown; params?: unknown },
  ) => Promise<FetchResult>;
  return call(path, params === undefined ? { body } : { body, params });
}

/**
 * GET sender for routes the generated spec snapshot does not carry yet
 * (the briefing/place endpoints predate their spec entry). Same
 * documented boundary as sendBody: one cast here keeps every call-site
 * typed against contract.ts instead of casting per caller. Behavior is
 * identical to `api.GET(path, {})`.
 */
function getRequest(path: string): Promise<FetchResult> {
  const call = api.GET as (p: string, o: object) => Promise<FetchResult>;
  return call(path, {});
}

// ===== Typed API functions =====

// Health
export const healthz = () => unwrap<HealthzResponse>(api.GET("/healthz", {}));

// Setup
export const getSetupStatus = () =>
  unwrap<Envelope<SetupData>>(api.GET("/api/setup/status", {}));

// World
export const getStatus = () =>
  unwrap<Envelope<StatusData>>(api.GET("/api/status", {}));

export const getDaily = () => unwrap<DailyResponse>(api.GET("/api/daily", {}));

// Journal — server contract: {ok, data:[JournalEvent…]} current-events
// list (query `n`, clamped 1..500 server-side); writes are {text};
// supersede is {supersedes: ts, text, reason?}; history is one chain by ts.
export const listJournal = (params?: { n?: number }) =>
  unwrap<Envelope<JournalEvent[]>>(
    api.GET("/api/journal", { params: { query: params } }),
  );

export const writeJournal = (body: JournalNoteRequest) =>
  unwrap<Envelope<JournalNoteData>>(sendBody("POST", "/api/journal", body));

export const supersedeJournal = (body: JournalSupersedeRequest) =>
  unwrap<Envelope>(sendBody("POST", "/api/journal/supersede", body));

export const journalHistory = (params: { ts: string }) =>
  unwrap<Envelope<JournalHistoryData>>(
    api.GET("/api/journal/history", { params: { query: params } }),
  );

/** GET /api/journal/last — the newest CURRENT journal entry (the
 * calm-view tail), or an honest `entry: null`. The read-only deep-link
 * contract behind the daily home loop's "Resume — yesterday's thread"
 * beat (TRUE-NORTH); deterministic with every model off. */
export const getJournalLast = () =>
  unwrap<Envelope<JournalLastData>>(api.GET("/api/journal/last", {}));

export const journalAudit = () =>
  unwrap<Envelope<JournalAuditData>>(api.GET("/api/journal/audit", {}));

// Journal drafts — the lining rescue (api.py journal_draft_*). The PUT
// body rides the sendBody adapter (raw-JSON route); the PUT response
// never echoes draft text.
export const putJournalDraft = (body: JournalDraftPutRequest) =>
  unwrap<Envelope<JournalDraftSavedData>>(
    sendBody("PUT", "/api/journal/draft", body),
  );

export const getJournalDraft = () =>
  unwrap<Envelope<JournalDraftData>>(api.GET("/api/journal/draft", {}));

export const deleteJournalDraft = () =>
  unwrap<Envelope<JournalDraftClearedData>>(
    api.DELETE("/api/journal/draft", {}),
  );

// Chat — the server picks the reasoning provider (no per-request
// provider field). An unconfigured provider answers 200 + ok:false;
// screens must read the envelope, not just the HTTP status.
export const sendChat = (body: ChatRequest) =>
  unwrap<ChatSendResponse>(sendBody("POST", "/api/chat", body));

export const listChatProviders = () =>
  unwrap<Envelope<ChatProvidersData>>(api.GET("/api/chat/providers", {}));

export const chatHistory = (params?: { n?: number }) =>
  unwrap<Envelope<ChatHistoryData>>(
    api.GET("/api/chat/history", { params: { query: params } }),
  );

// Proposals
export const listProposals = () => unwrap<Envelope<unknown[]>>(api.GET("/api/proposals", {}));

export const getProposal = (id: string) =>
  unwrap<Envelope>(
    api.GET("/api/proposals/{proposal_id}", { params: { path: { proposal_id: id } } }),
  );

export const approveProposal = (id: string) =>
  unwrap<Envelope>(
    api.POST("/api/proposals/{proposal_id}/approve", {
      params: { path: { proposal_id: id } },
    }),
  );

export const rejectProposal = (id: string) =>
  unwrap<Envelope>(
    api.POST("/api/proposals/{proposal_id}/reject", {
      params: { path: { proposal_id: id } },
    }),
  );

export const executeProposal = (id: string) =>
  unwrap<Envelope>(
    api.POST("/api/proposals/{proposal_id}/execute", {
      params: { path: { proposal_id: id } },
    }),
  );

// Actors — {ok, data: Actor[]}: the staff directory of connected PROVIDERS.
export const listActors = () =>
  unwrap<Envelope<Actor[]>>(api.GET("/api/actors", {}));

// Manifest
export const getManifest = () =>
  unwrap<ManifestResponse>(api.GET("/api/manifest", {}));

// Brain
export const listBrainTemplates = () =>
  unwrap<Envelope<{ templates: BrainTemplate[] }>>(
    api.GET("/api/brain/templates", {}),
  );

// Memory — the server parameter is `top_k` (api.py memory_search); the
// old client sent `limit`, which the server silently ignored. That real
// mismatch is fixed here rather than papered over.
export const searchMemory = (q: string, topK?: number) =>
  unwrap<Envelope>(
    api.GET("/api/memory/search", { params: { query: { q, top_k: topK } } }),
  );

// ===== Records (structured person data inside Memory) =====
// Contract: personal-world docs/RECORDS-API.md + api.py records_* —
// verified 2026-09-21. Reads are person-authenticated; every write is
// require_step_up gated (403 "write requires step-up auth" when the
// session carries no fresh grant). Reading a LOCKED category without
// fresh step-up answers the hard 409 envelope {status:"locked"} —
// unwrap throws it as ApiError(409), and the Records panel renders it
// as the step-up invitation, never as a dead end. With no memory
// provider the whole surface answers the 200 soft envelope
// {ok:false, status:"unavailable", warnings:["no memory provider"]}.

export const listRecordCategories = () =>
  unwrap<Envelope<RecordCategoriesData>>(api.GET("/api/records/categories", {}));

export const listRecords = (params?: {
  category?: string;
  pinned?: boolean;
  /** The deterministic lexical find (G-memory, models off): the
   * server matches title/category/fields — see docs/RECORDS-API.md
   * §Find. Locked categories only join results behind a server-
   * verified step-up; never a client-trusted flag. */
  q?: string;
}) =>
  unwrap<Envelope<RecordsListData>>(
    api.GET("/api/records", { params: { query: params } }),
  );

/** Create (no `id`) or update (`id`) one record. Step-up gated. */
export const writeRecord = (body: RecordWriteRequest) =>
  unwrap<Envelope<RecordItem>>(sendBody("POST", "/api/records", body));

export const pinRecord = (body: RecordTargetRequest) =>
  unwrap<Envelope<RecordItem>>(sendBody("POST", "/api/records/pin", body));

export const unpinRecord = (body: RecordTargetRequest) =>
  unwrap<Envelope<RecordItem>>(sendBody("POST", "/api/records/unpin", body));

/** DELETE /api/records reads raw request.json() like the other
 * body-carrying writes — hence sendBody, not a params-only call. */
export const deleteRecord = (body: RecordTargetRequest) =>
  unwrap<Envelope<{ deleted: boolean }>>(
    sendBody("DELETE", "/api/records", body),
  );

// Tools
export const listTools = () => unwrap<Envelope>(api.GET("/api/tools", {}));

// Auth
export const login = (token: string) =>
  unwrap<Envelope<LoginData>>(
    sendBody("POST", "/api/auth/login", { token } satisfies LoginRequest),
  );

export const logout = () => unwrap<Envelope>(api.POST("/api/auth/logout", {}));

export const getSession = () =>
  unwrap<Envelope<SessionData>>(api.GET("/api/auth/session", {}));

/** Re-present a credential to mint the time-bounded grant that
 * require_step_up consumes (auth_routes.py auth_step_up). Wrong or
 * absent credential fails closed: 403 "step-up credential invalid". */
export const stepUp = (token: string) =>
  unwrap<Envelope<StepUpData>>(
    sendBody("POST", "/api/auth/step-up", { token } satisfies StepUpRequest),
  );

// ===== Vault =====
export const getVaultStatus = () =>
  unwrap<Envelope<VaultStatusData>>(api.GET("/api/vault/status", {}));

export const unlockVault = (passphrase: string) =>
  unwrap<Envelope>(
    sendBody("POST", "/api/vault/unlock", {
      passphrase,
    } satisfies VaultUnlockRequest),
  );

export const lockVault = () => unwrap<Envelope>(api.POST("/api/vault/lock", {}));

export const listVaultNames = () =>
  unwrap<Envelope<VaultNamesData>>(api.GET("/api/vault/names", {}));

export const setVaultSecret = (name: string, value: string) =>
  unwrap<Envelope<{ name: string }>>(
    sendBody("POST", "/api/vault/set", { name, value } satisfies VaultSetRequest),
  );

export const getVaultSecret = (name: string) =>
  unwrap<Envelope<VaultSecretData>>(
    api.GET("/api/vault/{name}", { params: { path: { name } } }),
  );

export const deleteVaultSecret = (name: string) =>
  unwrap<Envelope<{ name: string }>>(
    api.DELETE("/api/vault/{name}", { params: { path: { name } } }),
  );

// ===== Prefs =====
export const getPrefs = () => unwrap<Envelope<PrefsData>>(api.GET("/api/prefs", {}));

export const putPrefs = (body: PrefsUpdateRequest) =>
  unwrap<Envelope<PrefsData>>(sendBody("PUT", "/api/prefs", body));

export const getPrefsSchema = () => unwrap<Envelope>(api.GET("/api/prefs/schema", {}));

// ===== Sections =====
// GET answers {ok, data:{schema, sections}}; PUT accepts the layout
// delta {order?, hidden?} of server-known section ids.
export const getSections = () =>
  unwrap<Envelope<SectionsData>>(api.GET("/api/sections", {}));

export const putSections = (body: SectionsUpdateRequest) =>
  unwrap<Envelope<SectionsData>>(sendBody("PUT", "/api/sections", body));

// ===== Reminders =====
export const listReminders = () =>
  unwrap<Envelope<Reminder[]>>(api.GET("/api/reminders", {}));

export const addReminder = (text: string) =>
  unwrap<Envelope>(
    sendBody("POST", "/api/reminders", { text } satisfies ReminderAddRequest),
  );

export const toggleReminder = (rid: string, enabled: boolean) =>
  unwrap<Envelope>(
    sendBody(
      "PATCH",
      "/api/reminders/{rid}",
      { enabled } satisfies ReminderPatchRequest,
      { path: { rid } },
    ),
  );

export const deleteReminder = (rid: string) =>
  unwrap<Envelope>(api.DELETE("/api/reminders/{rid}", { params: { path: { rid } } }));

// ===== Apps =====
export const listApps = () => unwrap<Envelope<unknown[]>>(api.GET("/api/apps", {}));

export const putApps = (body: AppsUpdateRequest) =>
  unwrap<Envelope>(sendBody("PUT", "/api/apps", body));

// ===== Themes =====
export const listThemes = () => unwrap<Envelope<unknown[]>>(api.GET("/api/themes", {}));

export const getTheme = (name: string) =>
  unwrap<Envelope>(api.GET("/api/themes/{name}", { params: { path: { name } } }));

// ===== Connections =====
export const getConnectionSchemas = () => unwrap<Envelope>(api.GET("/api/connections/schemas", {}));

export const getConnectionSchema = (capability: string) =>
  unwrap<Envelope>(
    api.GET("/api/connections/schema/{capability}", {
      params: { path: { capability } },
    }),
  );

export const getConnectionsConfig = () =>
  unwrap<Envelope>(api.GET("/api/connections/config", {}));

export const getConnectionsOverview = () =>
  unwrap<Envelope<unknown[]>>(api.GET("/api/connections/overview", {}));

export const listConnections = () => unwrap<Envelope<unknown[]>>(api.GET("/api/connections", {}));

export const saveConnection = (body: ConnectionSaveRequest) =>
  unwrap<Envelope<{ saved: boolean; name: string }>>(
    sendBody("PUT", "/api/connections", body),
  );

export const deleteConnection = (name: string) =>
  unwrap<Envelope>(api.DELETE("/api/connections/{name}", { params: { path: { name } } }));

export const testConnection = (body: ConnectionTestRequest) =>
  unwrap<Envelope>(sendBody("POST", "/api/connections/test", body));

export const validateConnection = (body: ConnectionTestRequest) =>
  unwrap<Envelope>(sendBody("POST", "/api/connections/validate", body));

// ===== Projects (agent-sync is the authoritative feed) =====
// GET /api/projects/status — api.py projects_status. Read-only estate
// observation; the command-absent / timeout / malformed cases answer a
// 200 + ok:false "unavailable" envelope, which screens read honestly.
export const getProjectsStatus = () =>
  unwrap<Envelope<ProjectsStatusData>>(api.GET("/api/projects/status", {}));

// ===== Worlds briefing + place (continuity) =====
// Contract v1, slice 1b. GET /api/briefing is read-only and
// person-authenticated; GET/PUT /api/place is the continuity seam
// (per-person scoped, atomic). Both carry the standard envelope and
// answer soft failures as data — hooks/screens read `ok` honestly.
export const getBriefing = () =>
  unwrap<Envelope<BridgeData>>(getRequest("/api/briefing"));

export const getPlace = () =>
  unwrap<Envelope<PlaceData>>(getRequest("/api/place"));

export const putPlace = (body: PlacePutRequest) =>
  unwrap<Envelope<PlaceData>>(sendBody("PUT", "/api/place", body));

// ===== Rooms (contract room/0) =====
// GET /api/rooms: one honest row per configured room — descriptor,
// needs-you, reachability and last-seen. An unreachable room is data
// (`reachable: false`), not an HTTP error; the panel renders it as
// "unreachable · last seen …", never as healthy. Read-only.
export const getRooms = () =>
  unwrap<RoomsEnvelope>(api.GET("/api/rooms", {}));

// POST /api/rooms/{id}/visit: record THIS person's visit (private,
// Worlds-owned; same-origin only). `link` must be a same-origin path, so
// a room on another host is recorded by title alone.
export const postRoomVisit = (roomId: string, body: { title?: string; link?: string }) =>
  unwrap<Envelope<{ room_id: string; last_visited_at: string; resume: RoomsResume | null }>>(
    sendBody("POST", `/api/rooms/${encodeURIComponent(roomId)}/visit`, body),
  );

// POST /api/rooms/{id}/needs/{need_id}/seen: idempotent, per person.
export const postNeedSeen = (roomId: string, needId: string) =>
  unwrap<Envelope<{ room_id: string; need_id: string; needs_seen: string[] }>>(
    sendBody(
      "POST",
      `/api/rooms/${encodeURIComponent(roomId)}/needs/${encodeURIComponent(needId)}/seen`,
      {},
    ),
  );

// GET /api/crew: this person's own companions, hidden ones included.
export const getCrew = () => unwrap<Envelope<CrewEntry[]>>(getRequest("/api/crew"));

// POST /api/crew: add a companion of their own (source "user").
export const addCrew = (body: { name: string; blurb?: string; voice_label?: string }) =>
  unwrap<Envelope<CrewEntry>>(sendBody("POST", "/api/crew", body));

// PATCH /api/crew/{id}: rename, reword, hide (starters included).
export const patchCrew = (
  id: string,
  body: { name?: string; blurb?: string | null; voice_label?: string | null; hidden?: boolean },
) => unwrap<Envelope<CrewEntry>>(sendBody("PATCH", `/api/crew/${encodeURIComponent(id)}`, body));

// DELETE /api/crew/{id}: a person's own companion only (starters → 409).
export const deleteCrew = (id: string) =>
  unwrap<Envelope<{ id: string; deleted: boolean; keepers_cleared: string[] }>>(
    sendBody("DELETE", `/api/crew/${encodeURIComponent(id)}`, {}),
  );

// POST /api/crew/{id}/portrait: PNG/JPEG/WebP ≤ 5 MB as base64 JSON.
export const uploadCrewPortrait = (id: string, contentType: string, dataBase64: string) =>
  unwrap<Envelope<CrewEntry>>(
    sendBody("POST", `/api/crew/${encodeURIComponent(id)}/portrait`, {
      content_type: contentType,
      data_base64: dataBase64,
    }),
  );

// PUT /api/rooms/{id}/doorway: a library doorway id, or null for none.
export const putRoomDoorway = (roomId: string, doorwayId: string | null) =>
  unwrap<Envelope<{ room_id: string; doorway: string | null }>>(
    sendBody("PUT", `/api/rooms/${encodeURIComponent(roomId)}/doorway`, {
      doorway_id: doorwayId,
    }),
  );

// PUT /api/rooms/{id}/keeper: one keeper per room, or null for none.
export const putRoomKeeper = (roomId: string, companionId: string | null) =>
  unwrap<Envelope<{ room_id: string; keeper: RoomKeeper | null }>>(
    sendBody("PUT", `/api/rooms/${encodeURIComponent(roomId)}/keeper`, {
      companion_id: companionId,
    }),
  );

// ===== Identity =====
export const getPrincipal = () =>
  unwrap<Envelope<PrincipalInfo>>(api.GET("/api/identity/principal", {}));

export const putPrincipal = (display_name: string) =>
  unwrap<Envelope<PrincipalInfo>>(
    sendBody("PUT", "/api/identity/principal", {
      display_name,
    } satisfies PrincipalPutRequest),
  );

export const listUsers = () => unwrap<Envelope<unknown[]>>(api.GET("/api/identity/users", {}));

export const createUser = (body: UserCreateRequest) =>
  unwrap<Envelope>(sendBody("POST", "/api/identity/users", body));

export const listAgents = () => unwrap<Envelope<unknown[]>>(api.GET("/api/identity/agents", {}));

// ===== Discovery =====
export const getDiscoveryStatus = () =>
  unwrap<Envelope<DiscoveryStatusData>>(api.GET("/api/discovery/status", {}));

export const listDiscoverySources = () =>
  unwrap<Envelope<unknown[]>>(api.GET("/api/discovery/sources", {}));

export const listDiscoveryInterests = () =>
  unwrap<Envelope<unknown[]>>(api.GET("/api/discovery/interests", {}));

export const triggerDiscovery = () =>
  unwrap<Envelope>(api.GET("/api/discovery/discover", {}));

// ===== Media =====
export const getMediaStatus = () => unwrap<Envelope>(api.GET("/api/media/status", {}));

export const getMediaLibrary = () => unwrap<Envelope>(api.GET("/api/media/library", {}));

export const getMediaRecent = () => unwrap<Envelope>(api.GET("/api/media/recent", {}));

export const getMediaActivity = () => unwrap<Envelope>(api.GET("/api/media/activity", {}));

export const searchMedia = (q: string) =>
  unwrap<Envelope>(api.GET("/api/media/search", { params: { query: { q } } }));

// ===== Endpoints the client does NOT call yet =====
// /api/projects/status, /api/source-control/*, /api/lab/*,
// /api/native-lab/*, /api/ingress/rollups, /api/updates,
// /api/exports/*, /api/reconciler/* exist on the server but are not
// part of the generated spec snapshot and have no typed wrapper here.
// Adding them means regenerating src/generated/openapi.json from the
// server contract — not hand-writing a wrapper against an unknown
// shape.
