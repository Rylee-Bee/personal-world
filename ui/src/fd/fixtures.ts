import type { Board, BoardItem, CardEnvelope } from "./types";

const T = "2026-10-01T09:30:00Z";
const EARLIER = "2026-10-01T08:12:00Z";
const ev = (id: string, path: string, extra: Partial<CardEnvelope["evidence"]> = {}) => ({
  request_id: id, method: "GET", path, status_code: 200, duration_ms: 84, ...extra,
});

export const cards: Record<string, CardEnvelope> = {
  weather: {
    card_id: "weather", source_state: "healthy", freshness: "current", observed_at: T, fetched_at: T, last_good_at: T,
    values: { temp: { text: "14", raw: 14 } },
    meter: { type: "day", events: [{ at: "09:00", label: "Walk" }, { at: "15:30", label: "Call" }], text_equivalent: "Two things today: Walk at 09:00, Call at 15:30" },
    meaning: { short: "Outside right now", full: "Current temperature near home, from your weather source." },
    evidence: ev("weather.now", "/v1/now"),
  },
  reading: {
    card_id: "reading", source_state: "healthy", freshness: "current", observed_at: T, fetched_at: T, last_good_at: T,
    values: { left: { text: "3", raw: 3 } },
    meter: { type: "shelf", items: ["Piranesi", "Hyperion", "Ancillary Justice"], text_equivalent: "On the shelf: Piranesi, Hyperion, Ancillary Justice" },
    meaning: { short: "Books you are in", full: "Books you have started and not finished." },
    evidence: ev("reading.shelf", "/shelf"),
  },
  inbox: {
    card_id: "inbox", source_state: "needs_attention", freshness: "current", observed_at: T, fetched_at: T, last_good_at: T,
    values: { waiting: { text: "5", raw: 5 } },
    meter: { type: "marks", shown: 3, more: 2, text_equivalent: "5 waiting; 3 shown, 2 more" },
    meaning: { short: "Waiting on you", full: "Items from your rooms that need a decision from you." },
    evidence: ev("inbox.needs-you", "/room/needs-you"),
  },
  downloads: {
    card_id: "downloads", source_state: "unavailable", freshness: "stale", observed_at: null, fetched_at: T, last_good_at: EARLIER,
    values: { active: { text: "2", raw: 2 } },
    meter: { type: "progress", value: 40, max: 100, text_equivalent: "Last known: 40 percent of the queue done" },
    meaning: { short: "Downloads in progress", full: "The queue Sonarr is working through. Showing the last good reading." },
    evidence: ev("sonarr.queue", "/api/v3/queue", { status_code: 500, error_class: "http_5xx", note: "Upstream returned 500" }),
  },
  backup: {
    card_id: "backup", source_state: "stale", freshness: "stale", observed_at: EARLIER, fetched_at: T, last_good_at: EARLIER,
    values: { age: { text: "26", raw: 26 } },
    meter: { type: "bars", values: [1, 1, 1, 0.8], max: 1, text_equivalent: "Last four runs: three full, one partial" },
    meaning: { short: "Last backup", full: "When the nightly backup last finished." },
    evidence: ev("restic.last", "/snapshots", { status_code: undefined, error_class: "timeout", duration_ms: 5000 }),
  },
  disk: {
    card_id: "disk", source_state: "healthy", freshness: "current", observed_at: T, fetched_at: T, last_good_at: T,
    values: { used: { text: "61", raw: 61 } },
    meter: { type: "progress", value: 61, max: 100, text_equivalent: "61 percent used" },
    meaning: { short: "Disk space", full: "How full the main disk is." },
    evidence: ev("node.disk", "/metrics"),
  },
  checks: {
    card_id: "checks", source_state: "healthy", freshness: "current", observed_at: T, fetched_at: T, last_good_at: T,
    values: { passing: { text: "24", raw: 24 } },
    meter: { type: "dots", on: 24, total: 24, text_equivalent: "24 of 24 checks passing" },
    meaning: { short: "Health checks", full: "Small checks that run every few minutes." },
    evidence: ev("checks.all", "/checks"),
  },
  /** Reference-provider response that did not match the mapping: no values, no meter, never 0. */
  malformed: {
    card_id: "malformed", source_state: "unknown", freshness: "stale", observed_at: null, fetched_at: T, last_good_at: null,
    values: {}, meter: null,
    meaning: { short: "Calendar", full: "Your calendar. The answer could not be read." },
    evidence: ev("cal.today", "/today", { error_class: "malformed", note: "Response did not match the card mapping" }),
  },
  music: {
    card_id: "music", source_state: "not_configured", freshness: "current", observed_at: null, fetched_at: T, last_good_at: null,
    values: {}, meter: null,
    meaning: { short: "Music", full: "Connect a player to see what is on." },
    evidence: ev("music.now", "/now", { status_code: undefined }),
  },
  /** An empty list is healthy, not unavailable. */
  later: {
    card_id: "later", source_state: "healthy", freshness: "current", observed_at: T, fetched_at: T, last_good_at: T,
    values: { count: { text: "0", raw: 0 } },
    meter: { type: "marks", shown: 0, more: 0, text_equivalent: "Nothing waiting" },
    meaning: { short: "Kept for later", full: "Things you set aside to come back to." },
    evidence: ev("memory.later", "/memory/later"),
  },
};

const item = (card: string, title: string, icon: string, group: BoardItem["group"], field: string, unit?: string, extra: Partial<BoardItem> = {}): BoardItem =>
  ({ card, size: "M", hidden: false, title, icon, group, primary: { field, unit }, ...extra });

export const homeBoard: Board = {
  id: "home", title: "Home", home: true,
  items: [
    item("inbox", "Inbox", "inbox", "life", "waiting", "waiting", { needs_you: true }),
    item("weather", "Weather", "sun", "life", "temp", "°C"),
    item("reading", "Reading", "book", "life", "left", "books"),
    item("later", "Later", "bookmark", "life", "count", "kept"),
    item("music", "Music", "music", "life", "count"),
    item("downloads", "Downloads", "download", "machine", "active", "active", { size: "L" }),
    item("backup", "Backup", "archive", "machine", "age", "h ago"),
    item("malformed", "Calendar", "calendar", "life", "count"),
    item("disk", "Disk", "disk", "machine", "used", "%", { size: "S" }),
    item("checks", "Checks", "check", "machine", "passing", "of 24", { size: "S" }),
  ],
};
