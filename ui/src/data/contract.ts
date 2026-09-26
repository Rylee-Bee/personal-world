/**
 * PROJECT WORLDS — Live-contract DTOs (the E7 reconciliation, 2026-09-20)
 *
 * The generated OpenAPI types (src/generated/api-types.ts) are the
 * contract the server PUBLISHES: most Station routes answer plain dicts
 * and read raw `request.json()`, so the generator types responses as
 * `{}` / `unknown` and request bodies as absent. That is honest output
 * about an untyped seam, not a generator bug.
 *
 * So the strict-mode UI keeps its types, this module carries the field
 * shapes the UI actually reads, every one verified against the handler
 * that emits or consumes it (src/personal_world/api.py,
 * auth_routes.py, prefs.py, sections.py, loop.py, chat_history.py,
 * scheduler.py, model.py, template_registry.py, api_manifest.py,
 * providers/registry.py — verified 2026-09-20). When the server later
 * declares real Pydantic response/request models, call-sites migrate
 * back to the generated types and this file shrinks — that is the
 * direction of truth; do not widen it by guesswork.
 */

// ─── Envelope ────────────────────────────────────────────
// The station's shared response shape (envelope.py `ok()`): a soft
// failure is HTTP 200 + ok:false + status/warnings; hard failures are
// real HTTP errors. `data` is whatever the handler puts there.

export interface Envelope<D = unknown> {
  ok?: boolean;
  status?: string;
  warnings?: string[];
  data?: D;
}

// ─── Journal (model.py: JournalEvent, Provenance) ────────

export interface Provenance {
  source: string;
  observed_at: string;
  provider: string | null;
  authority: string;
}

export interface JournalEvent {
  ts: string;
  kind: string;
  summary: string;
  provenance: Provenance;
  classification: string;
  supersedes: string | null;
  supersede_reason: string | null;
}

export interface JournalNoteRequest {
  text: string;
}

export interface JournalNoteData {
  written: number;
}

export interface JournalSupersedeRequest {
  supersedes: string;
  text: string;
  reason?: string;
  drafted_by?: string;
}

export interface JournalHistoryData {
  entries: JournalEvent[];
}

/** GET /api/journal/last (api.py journal_last) — the read-only
 * deep-link contract for the daily home loop's "Resume — yesterday's
 * thread" beat: the newest CURRENT entry (the calm-view tail, exactly
 * what GET /api/journal shows last), or an honest null on an empty
 * journal. Person-only, caller-scoped, never mutates. */
export interface JournalLastData {
  entry: JournalEvent | null;
}

export interface JournalAuditData {
  text: string;
}

// ─── Journal draft (lining rescue, DRAFT-SYNC-SPEC-2026-09-20) ──
// api.py journal_draft_put/get/delete. The PUT response never echoes
// text; GET answers text:null + updated_at:null when no draft exists.

export interface JournalDraftPutRequest {
  entry_id?: string;
  text: string;
  device?: string;
}

export interface JournalDraftSavedData {
  saved_at: string;
  length: number;
}

export interface JournalDraftData {
  text: string | null;
  updated_at: string | null;
  entry_id?: string;
  device?: string;
  length?: number;
}

export interface JournalDraftClearedData {
  cleared: boolean;
}

// ─── Capabilities / world (providers/registry.py status_map,
//     world.py summary, api.py status) ─────────────────────

export interface CapabilityObservation {
  ok: boolean;
  status: string;
  warnings: string[];
  last_observed?: string;
}

export type CapabilityMap = Record<string, CapabilityObservation>;

/** model.py: Actor — staff directory of connected providers. */
export interface Actor {
  name: string;
  role: string;
  provider?: string | null;
  capabilities: string[];
  status: string;
  secrets: string;
  writes: string;
}

export interface WorldSummary {
  facts: number;
  intents: number;
  policies: number;
  cemented_policies: number;
  lore: Record<string, number>;
  declared_capabilities: number;
  providers: number;
  packs: number;
}

export interface StatusData extends WorldSummary {
  capabilities: CapabilityMap;
  actors: Actor[];
}

/** loop.py `daily()` digest (GET /api/daily; POST runs the loop). */
export interface DailyData {
  world: WorldSummary;
  capabilities: CapabilityMap;
  attention: string[];
}

export interface DailyResponse extends Envelope<DailyData> {
  changed?: boolean;
  actions?: string[];
}

// ─── Projects (GET /api/projects/status — the agent-sync sensor) ────
// api.py projects_status: agent-sync is AUTHORITATIVE for repository
// publication state; the envelope carries its own dated observation
// (observed_at) and a derived freshness that never rewrites state.
// Closed vocabularies mirror providers/agent_sync.py; anything outside
// them arrives as null / "unknown" and stays honestly unknown here.

export type ProjectPublishState = "match" | "ahead" | "behind" | "diverged";
export type ProjectSafeState =
  | "yes"
  | "published-with-local-work"
  | "no"
  | "unknown";

export interface ProjectStatusRow {
  project: string;
  path: string | null;
  is_git_repo: boolean;
  branch: string | null;
  local_head: string | null;
  remote_name: string | null;
  /** The authoritative source for this repository's Git truth. */
  remote_url: string | null;
  remote_head: string | null;
  publish_state: ProjectPublishState | null;
  /** agent-sync guarantees four non-negative ints (_coerce_count). */
  working_tree: {
    staged: number;
    modified: number;
    untracked: number;
    conflicted: number;
  };
  play_nice: {
    present: boolean;
    revision: string | null;
    source_repository: string | null;
  };
  work_state: string;
  safe_to_leave: ProjectSafeState;
  error: string | null;
}

export interface ProjectsStatusData {
  observed_at: string | null;
  freshness: "fresh" | "stale" | "unknown";
  age_seconds: number | null;
  projects: ProjectStatusRow[];
}

// ─── Discovery (GET /api/discovery/status — native_discovery.observe) ─
// Counts and rows as the provider reports them; Overview's sliver and
// the Interests screen both read this envelope.

export interface DiscoveryStatusData {
  sources?: unknown[];
  interests?: unknown[];
  items?: unknown[];
  source_count?: number;
  interest_count?: number;
  item_count?: number;
}

// ─── Chat (api.py chat/chat_providers/chat_history,
//     chat_history.py NDJSON entries) ─────────────────────

export interface ChatProviderInfo {
  name: string;
  display_name: string;
  status: string;
  ok: boolean;
}

export interface ChatProvidersData {
  providers: ChatProviderInfo[];
  active: string | null;
}

/** One transcript line: {ts (epoch seconds), role, content, provider?}. */
export interface ChatHistoryEntry {
  ts: number;
  role: string;
  content: string;
  provider?: string;
}

export interface ChatHistoryData {
  entries: ChatHistoryEntry[];
  count: number;
}

export interface ChatRequest {
  message: string;
  history?: { role: string; content: string }[];
  ui?: Record<string, unknown>;
}

export interface ChatSendData {
  reply?: string;
  provider?: string;
  proposal?: unknown;
}

export interface ChatSendResponse extends Envelope<ChatSendData> {
  changed?: boolean;
  actions?: unknown[];
}

// ─── Proposals (api.py proposals_list) ───────────────────
// No surface reads proposal fields yet (C-track will), so the row
// shape stays unknown rather than invented.

export type Proposal = Envelope<unknown>;

// ─── Health / setup / auth (api.py healthz, setup_status,
//     auth_routes.py login/session) ───────────────────────

export interface HealthzResponse extends Envelope {
  auth_configured?: boolean;
  setup_needed?: boolean;
  dev_bypass?: boolean;
  /** Short SHA of the commit the running build came from (PW_COMMIT,
   * baked in by publish-image.yml); null on local/unlabelled builds. */
  commit?: string | null;
}

export interface SetupData {
  complete: boolean;
}

export interface LoginRequest {
  token: string;
}

export interface LoginData {
  session_id: string;
  auth_method: string;
}

export interface SessionData {
  principal_id: string;
  auth_method: string;
  has_step_up: boolean;
}

// ─── Records (api.py records_* + records.py; docs/RECORDS-API.md) ─
// Structured person data inside Memory. A category row is
// {slug, name, locked, count, pinned-count}; a record is a World Fact
// value {id, category, category_name, title, fields, pinned, created,
// updated}. Field VALUES are JSON scalars (records._clean_fields
// rejects anything richer). Soft refusals ride the envelope: the
// degraded state is {ok:false, status:"unavailable", warnings:["no
// memory provider"]}; a not_found pin/delete is {ok:false,
// status:"not_found"}. The locked read is the one HARD refusal: HTTP
// 409 + {ok:false, status:"locked", category, warnings:[…]}.

export interface RecordCategoryRow {
  slug: string;
  name: string;
  locked: boolean;
  count: number;
  pinned: number;
}

export interface RecordFieldMap {
  [key: string]: string | number | boolean | null;
}

export interface RecordItem {
  id: string;
  category: string;
  category_name: string;
  title: string;
  fields: RecordFieldMap;
  pinned: boolean;
  created: string;
  updated: string;
}

export interface RecordCategoriesData {
  categories: RecordCategoryRow[];
}

/** GET /api/records: ?category= adds {category, locked}; the pinned
 * feed and aggregate browse answer {records} only. So category and
 * locked are optional here — whatever the server actually echoed. */
export interface RecordsListData {
  category?: string;
  locked?: boolean;
  records: RecordItem[];
  /** Echoed by the server on the deterministic `?q=` find path only. */
  query?: string;
}

/** POST /api/records body (raw request.json(); create when `id` is
 * absent; `locked`, when present, sets the category lock in the same
 * step-up-gated write). */
export interface RecordWriteRequest {
  id?: string;
  category: string;
  title: string;
  fields?: RecordFieldMap;
  locked?: boolean;
}

/** POST /api/records/pin | /unpin and DELETE /api/records bodies. */
export interface RecordTargetRequest {
  category: string;
  id: string;
}

// ─── Step-up elevation (auth_routes.py auth_step_up) ──────
// POST /api/auth/step-up re-presents a credential and mints the
// time-bounded grant require_step_up consumes. 403 = the credential
// did not match this session's principal (fail-closed, never says
// which half failed).

export interface StepUpRequest {
  token: string;
}

export interface StepUpData {
  has_step_up: true;
  expires_in: number;
  principal_id: string;
}

// ─── Vault (api.py vault_*; never values in status/names) ─

export interface VaultStatusData {
  locked: boolean;
  encrypted: boolean;
  warning?: string;
}

export interface VaultNamesData {
  names: string[];
}

export interface VaultSecretData {
  name: string;
  value: string;
}

export interface VaultUnlockRequest {
  passphrase: string;
}

export interface VaultSetRequest {
  name: string;
  value: string;
}

// ─── Prefs (prefs.py: clamped/validated keys) ───────────
//
// tone + personality_pack (TRUE-NORTH § Voice, W1-B) are optional at
// the type level so older mock/server bodies still parse; the runtime
// vocabulary stays the server's (GET /api/prefs/schema), and an absent
// tone degrades to the default register (language/tone.ts parseTone).

export interface PrefsData {
  motion: string;
  contrast: string;
  text_scale: number;
  density: string;
  target_size: number;
  companion: string;
  /** The chosen companion: a crew id (GET /api/crew), or null for the
   *  plain voice — shown as the Assistant. Supersedes `companion` once
   *  stored; the server migrates the old key by canon (prefs.py). */
  companion_id?: string | null;
  accent: string;
  tone?: string;
  personality_pack?: string;
}

export type PrefsUpdateRequest = Partial<PrefsData>;

// ─── Sections (sections.py resolve_sections rows; PUT takes
//     the layout delta {order?, hidden?}) ─────────────────

export interface SectionRow {
  id: string;
  label: string;
  icon: string;
  order: number;
  visible: boolean;
  pinned: boolean;
  kind: string;
  configured: boolean;
  status: string | null;
}

export interface SectionsData {
  schema: unknown;
  sections: SectionRow[];
}

export interface SectionsUpdateRequest {
  order?: string[];
  hidden?: string[];
}

// ─── Reminders (scheduler.py:48 Reminder; POST body
//     {id?, text, cron_*}; PATCH body {enabled}) ──────────

export interface Reminder {
  id: string;
  text: string;
  cron_hour: number | null;
  cron_minute: number | null;
  cron_day: string | null;
  enabled: boolean;
  last_fired: number | null;
  created_at: number;
}

export interface ReminderAddRequest {
  text: string;
  id?: string;
  cron_hour?: number | null;
  cron_minute?: number | null;
  cron_day?: string | null;
}

export interface ReminderPatchRequest {
  enabled: boolean;
}

// ─── Apps (api.py apps_put: {apps: [...]} replaces the
//     registry; item fields belong to the editor surface) ─

export interface AppsUpdateRequest {
  apps: unknown[];
}

// ─── Connections (api.py connections_save: body must carry
//     `name`; the rest is the connection document) ────────

export interface ConnectionSaveRequest {
  name: string;
  [key: string]: unknown;
}

export type ConnectionTestRequest = Record<string, unknown>;

// ─── Identity (api.py identity_principal GET/PUT,
//     users_create: {user_id, display_name?, token?}) ─────

export interface PrincipalInfo {
  id: string;
  kind: string;
  display_name: string;
  scopes: string[];
  source: string;
}

export interface PrincipalPutRequest {
  display_name: string;
}

export interface UserCreateRequest {
  user_id: string;
  display_name?: string;
  token?: string;
}

// ─── Brain (template_registry.py Template.to_dict +
//     has_override; GET /api/brain/templates) ─────────────

export interface BrainTemplate {
  id: string;
  version: string;
  kind: string;
  surface: string | null;
  max_tokens: number;
  source: string;
  description: string;
  content_length: number;
  has_override?: boolean;
}

// ─── Manifest (api_manifest.py _serialize rows under
//     `endpoints`; `data` stays the capability manifest) ──

export interface EndpointRow {
  id: string | null;
  method: string;
  path: string;
  capability: string;
  kind: string;
  gate: string;
  auth: string;
  present: boolean;
  note?: string;
}

export interface ManifestResponse extends Envelope<Record<string, unknown>> {
  endpoints: EndpointRow[];
}

// ─── Worlds briefing (contract v1, slice 1b "first light") ────────────
//
// GET /api/briefing — the world's own account of itself: the Keeper's
// line, one system per resident, and the cross-system rooms she needs.
// GET/PUT /api/place — continuity: where she was when she left.
//
// The briefing is read-only and person-scoped; every field here is
// copied from the published contract (worlds-briefing/1), never
// inferred. `at`, `observed_at`, `generated_at`, `since`, and
// `updated_at` are ISO-8601 or the honest null the contract declares —
// unknown stays unknown.

/** The six systems of v1, in contract order. */
export type BridgeSystemId =
  | "agents"
  | "estate"
  | "records"
  | "interests"
  | "news"
  | "threads";

export type BridgeMood =
  | "greeting"
  | "calm"
  | "busy"
  | "sleepy"
  | "celebrating";

export type BridgeFreshness = "fresh" | "stale" | "unknown";

export type BridgeItemKind = "arrival" | "have_to" | "thread" | "interest";

export interface BridgeResident {
  /** The crew id, or null for Worlds (the place, not a companion). */
  key: string | null;
  name: string;
  /** The companion's own portrait path, or an honest null. */
  portrait: string | null;
}

export interface BridgeCounts {
  arrivals: number;
  have_tos: number;
}

export interface BridgeSource {
  name: string;
  observed_at: string | null;
  freshness: BridgeFreshness;
}

/** Where an item can take the person next. `area` is a state-routed
 *  destination; `href` is an outbound link (opens in a new tab); both
 *  may be null — the item is then read-only. */
export interface BridgeLink {
  label: string;
  href: string | null;
  area: string | null;
}

export interface BridgeItem {
  id: string;
  system: BridgeSystemId;
  kind: BridgeItemKind;
  title: string;
  detail: string | null;
  at: string | null;
  /** True only when the item arrived after the stored place's
   *  `updated_at`; false whenever there was no `since`. */
  new: boolean;
  link: BridgeLink | null;
}

export interface BridgeSystem {
  id: BridgeSystemId;
  name: string;
  /** The starter companion reporting this system, or null when that
   *  companion is hidden or gone from the person's crew (plain emblem);
   *  never an invented resident. */
  resident: BridgeResident | null;
  status: string;
  voice: string;
  counts: BridgeCounts;
  source: BridgeSource;
  items: BridgeItem[];
}

export interface BridgeKeeper {
  line: string;
  mood: BridgeMood;
  resident: BridgeResident;
  /** Time-of-day greeting from the server clock ("Good morning"). */
  greeting?: string | null;
  /** The person's display name when known; null otherwise (never guessed). */
  name?: string | null;
}

export interface BridgeData {
  schema: string;
  generated_at: string;
  /** Previous visit's stored place time, or null on a first visit. */
  since: string | null;
  keeper: BridgeKeeper;
  systems: BridgeSystem[];
  /** Top three across all systems, most important first. */
  have_tos: BridgeItem[];
  have_tos_total: number;
  /** Top five across systems, newest first. */
  arrivals: BridgeItem[];
  /** The person's own latest journal entry — never a machine line. */
  thread: BridgeItem | null;
}

export interface Place {
  system: string | null;
  item_id: string | null;
  updated_at: string;
}

export interface PlaceData {
  place: Place | null;
}

export interface PlacePutRequest {
  system: string | null;
  item_id: string | null;
}

// ─── Rooms (contract room/0; GET /api/rooms) ─────────────────────────
//
// The front door renders other small backends — rooms — without owning
// their code. `GET /api/rooms` answers one honest row per configured
// room: its descriptor, the needs it is charging attention for, and
// whether it answered. An unreachable room is `reachable: false`,
// `room: null`, `status: "unreachable"` with its in-memory `last_seen`
// — never blanked, never claimed healthy (room/0 rules 11–12).
//
// Field shapes copied from the canonical Room contract (room/0); the
// server validates/derives `status` so an off-vocabulary descriptor
// value arrives as "unknown", never as a guess.

/** `status` is exactly one of these for a reachable room; the front
 *  door adds `unreachable` for one that did not answer and
 *  `incompatible` for one whose contract (registry entry or its own
 *  descriptor) this front door does not support. */
export type RoomStatus =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "unknown"
  | "unreachable"
  | "incompatible";

export interface RoomDescriptor {
  contract: string;
  id: string;
  name: string;
  icon: string;
  /** Optional display persona label — a caption hint, never a claim. */
  voice?: string | null;
  version: string;
  commit: string;
  status: string;
  updated_at: string;
}

export interface RoomNeed {
  id: string;
  title: string;
  why: string;
  actions: string[];
  created_at: string;
  /** room/0 1.1.0, optional: a same-origin path to the exact item. Only
   *  followed when it starts with "/" (not "//") and has no scheme. */
  link?: string | null;
}

export interface RoomRow {
  id: string;
  base_url: string;
  reachable: boolean;
  status: string;
  room: RoomDescriptor | null;
  needs_you: RoomNeed[];
  /** A short failure class only ("connect error", "timeout",
   *  "malformed JSON", …) or null. Never a token or payload. */
  error: string | null;
  checked_at: string;
  /** Last time this room was reachable, persisted across restarts
   *  (rooms-state.json); null when it has never answered. */
  last_seen: string | null;
  /** The status it had when last seen (persisted with last_seen). */
  last_status?: string | null;
  /** The room's cards (room/0). Optional: older fixtures omit them. */
  cards?: RoomCard[];
  // ── The caller's own, Worlds-owned visit state (never sent to rooms) ──
  /** When THIS person last opened the room; null = never. */
  last_visited_at?: string | null;
  /** Need ids this person has marked seen. */
  needs_seen?: string[];
  /** Cards observed strictly after the last visit; 0 when never visited
   *  or when no card says when it was observed (unknown is not changed). */
  changed_since_visit?: number;
  /** The companion this person put on the room, or null (the room shows
   *  its own emblem). A keeper never changes a room's status. */
  keeper?: RoomKeeper | null;
  /** The library doorway this person chose for the room (PUT
   *  /api/rooms/{id}/doorway), or null: never assigned by default. */
  doorway?: string | null;
}

export interface RoomCard {
  id: string;
  title: string;
  body?: string;
  link?: string | null;
  lane?: string;
  /** room/0 1.1.0, optional: "when_ready" means it can wait. */
  tone?: string | null;
  freshness?: { observed_at?: string; stale_after_s?: number } | null;
}

/** crew.keeper_of: who keeps a room, for this person. */
export interface RoomKeeper {
  id: string;
  name: string;
  /** A frontend asset path (/assets/crew/…) or the same-origin upload
   *  route; null when the companion has no picture. */
  portrait_url: string | null;
  /** Shown in a ring when there is no portrait. */
  initial: string;
}

/** The last room this person opened (rooms_visits.resume_of). */
export interface RoomsResume {
  room_id: string;
  title: string | null;
  link: string | null;
  at: string;
}

/** rooms_visits.summarize over this person's rows. */
export interface RoomsSummary {
  /** Unseen needs across reachable, understood rooms. */
  needs_you: number;
  changed: number;
  can_wait: number;
  /** Needs from rooms we can't currently read — not current. */
  unknown: number;
  unreachable: number;
}

/** Where the room list came from this snapshot (Gap 1: the list is read
 *  at runtime from Project Home's registry when one is configured). */
export interface RoomsRegistry {
  /** `registry` — the configured registry answered; `last_known_good` —
   *  it did not, and the persisted last good list is served; `env` —
   *  `PW_ROOMS`. */
  source: "registry" | "last_known_good" | "env";
  /** The registry read itself: ok | unreachable | not_configured. */
  status: "ok" | "unreachable" | "not_configured";
  /** When the registry was last checked (ISO), or null. */
  checked_at: string | null;
  /** A short failure class only, or null. Never a URL, token or payload. */
  error?: string | null;
  /** The registry's own `updated_at`, or null. */
  updated_at?: string | null;
  /** Entries the registry returned that were malformed and dropped. */
  dropped?: number;
}

/** GET /api/rooms: `resume`, `summary` and `registry` travel beside `data`. */
export interface RoomsEnvelope extends Envelope<RoomRow[]> {
  resume?: RoomsResume | null;
  summary?: RoomsSummary;
  registry?: RoomsRegistry;
}

/** One companion in this person's crew (GET /api/crew, crew.py). */
export interface CrewEntry {
  id: string;
  name: string;
  blurb?: string | null;
  voice_label?: string | null;
  portrait_asset?: string | null;
  full_body_asset?: string | null;
  source: "starter" | "user";
  hidden: boolean;
}
