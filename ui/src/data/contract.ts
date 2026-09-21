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

// ─── Prefs (prefs.py: seven keys, clamped/validated) ─────

export interface PrefsData {
  motion: string;
  contrast: string;
  text_scale: number;
  density: string;
  target_size: number;
  companion: string;
  accent: string;
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
