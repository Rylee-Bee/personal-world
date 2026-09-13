import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { saveApps, saveJournalEntry, ApiError, type DailyData, type JournalEntry, type ServiceApp, type LabEnvelope } from "../lib/api";
import { useDaily, useApps, useLabState, useJournalPage, useJournalKey, useAgentSyncProjects, usePrincipal } from "../lib/hooks";
import { observationAge } from "../lib/observation-age";
import { projectCategory, projectSentence, CATEGORY_ORDER, NEEDS_ATTENTION } from "../lib/project-status";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { ErrorState } from "../shell/ErrorState";
import { Button } from "../components/ui/button";
import { Loader2, AlertCircle, BookOpen, Clock, Plus, Sparkles, X, Inbox, Heart, Bell } from "../lib/icons";

/**
 * TodayScreen (P1 T10, parity rows 1–3, FOUNDATION-SPEC §7; Workshop v3
 * warmth pass 2026-09-13, frame 17:481 "Today — Quiet Day" / WARM):
 *
 * Everything renders from real data via the typed client:
 * - greeting h1 from the principal display name when the world knows it
 *   (never fabricated), time-of-day warmth, host-local date (row 15);
 * - health sentence from /api/status (capability counts, canonical words)
 *   in the design's Health summary chip (17:513);
 * - the quiet-day state renders the 17:522 companion message —
 *   "Nothing needs you right now." — with the canonical companion rig
 *   via CompanionSlot (audit reservation mermaid-art) and a static warm
 *   gradient; a day WITH attention renders the restrained list instead
 *   (ATTENTIVE register, no alarm chrome);
 * - "what changed" from /api/daily actions — ABSENT entirely on a quiet
 *   day (no fabricated "Recent Changes", row 15); the 17:533 panel
 *   design applies only to real recorded actions;
 * - journal composer + recent entries from /api/journal?n= in the
 *   17:546 panel design;
 * - "More from your world": Services launcher (GET/PUT /api/apps with
 *   step-up via useStepUp), Subscription usage (lab packet rows),
 *   Capabilities table with per-row StatusChip + Disclosure provenance.
 *
 * The shell owns <main#main-content> — this screen renders bare inside
 * it. Dates render from the host (toLocaleDateString); no hard-coded
 * version/timezone/host strings anywhere (row 15).
 *
 * Composition (Workshop v3 / WARM register): the two activity panels use
 * the frame's surface-panel treatment with real h2 headings (A11y §4.1);
 * quiet dividers separate unframed sections; the healthy/not-yet-connected
 * capability majority stays collapsed behind one honest count line
 * (Finish Line: "healthy systems stay quiet") — never removed from the
 * DOM. No motion is added; the glow shadows are static (motion tokens
 * default 0ms, prefers-reduced-motion unconditionally overrides).
 */

/** "chat exchange with …" is humanized like the legacy journal (api.py
 * eventSummary) — the technical opening is never the person's words. */
function eventSummary(entry: JournalEntry): string {
  const summary = String(entry.summary || "Journal entry");
  if (summary.toLowerCase().startsWith("chat exchange with ")) {
    return "A conversation with Personal World";
  }
  return summary;
}

function eventTime(ts: string): string {
  const date = new Date(ts);
  if (!ts || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A raw status from the server is only a chip if it is canonical
 * (status.py vocabulary); unknown words render no chip, not a lie. */
const CANONICAL_STATUS_LIST = [
  "healthy",
  "warning",
  "unknown",
  "needs_attention",
  "unavailable",
  "stale",
  "disabled",
  "not_configured",
] as const;

function asCanonicalStatus(status: string): CanonicalStatus | null {
  return (CANONICAL_STATUS_LIST as readonly string[]).includes(status)
    ? (status as CanonicalStatus)
    : null;
}

// ── Phone composition (Workshop v3 frame 17:1929 "Today", 390×844 —
//    the responsive interpretation of 17:481's quiet-day state) ──

/** Phone heading scale: the frame's 28px greeting (17:1939) vs the
 * desktop 40px (17:6279) — same h1, one semantic element, two bucket
 * scales (A11y §5.3: CSS may change placement, never semantics). */
const GREETING_DESKTOP_CLASS = "min-[600px]:text-[40px] text-[28px] min-[600px]:leading-[1.15] leading-[1.18]";

/** Time-of-day greeting (design/screens greeting-block pattern). The
 * name comes from the principal the world actually knows
 * (/api/identity/principal via usePrincipal); when it is unknown or
 * still loading the greeting stays generic and honest — a name is
 * never fabricated (frame 17:511 greets by name; repo truth decides
 * whether it can). */
function greetingForNow(now: Date, name: string | null): string {
  const hour = now.getHours();
  const timeOfDay =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
        ? "Good afternoon"
        : "Good evening";
  return name ? `${timeOfDay}, ${name}.` : `${timeOfDay}.`;
}

function localIsoDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The greeting area (frame 17:509–17:512): the greeting IS the page
 * h1 (Young Serif, accent teal, 40px, with the aria-hidden ✦), the
 * host-local date in the rose accent (17:512), and the decorative
 * greeting companion beside it — aria-hidden artwork, never a second
 * trigger, absent entirely when the companion pref is off. */
function TodayHeading() {
  const now = new Date();
  const principal = usePrincipal();
  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;
  return (
    <div className="space-y-2">
      <h1
        id="today-health-heading"
        className={GREETING_DESKTOP_CLASS}
        style={{ fontFamily: "var(--pw-typography-font-expressive)", color: "var(--pw-color-accent-primary)" }}
      >
        {greetingForNow(now, name)}
        <span aria-hidden="true"> ✦</span>
      </h1>
      <p className="text-base" style={{ color: "var(--pw-color-accent-secondary)" }}>
        <time dateTime={localIsoDate(now)}>
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </time>
      </p>
    </div>
  );
}

function TodayScreen() {
  const daily = useDaily();
  const journal = useJournalPage(20);
  const apps = useApps();
  const lab = useLabState();
  const bumpJournal = useJournalKey();
  const { announce } = useAnnounce();
  const stepUp = useStepUp();

  return (
    <>
      {stepUp.prompt}
      {/* The shell owns the content measure (index.css .pw-main); this
          screen renders bare inside it — one width system per route
          (T14 human gate 2). The two activity panels form the frame's
          side-by-side row (17:533) at the desktop bucket (≥900px,
          RESPONSIVE_RULES) and stack below it; DOM order (changes,
          journal) is the semantic source order (A11y §5.2) at every
          width. */}
      <div className="space-y-6">
        <HealthSection daily={daily} />
        <AttentionSection daily={daily} />
        <ProjectsTodaySection />
        <div className="grid gap-6 min-[900px]:grid-cols-2 min-[900px]:items-start">
          <WhatChangedSection daily={daily} />
          <JournalSection journal={journal} onSaved={() => { bumpJournal(); announce("Note saved to your journal.", { kind: "action_completed", key: "today-journal-note" }); }} />
        </div>
        <MoreFromWorld daily={daily} apps={apps} lab={lab} stepUp={stepUp} announce={announce} />
      </div>
    </>
  );
}

type DailyState = ReturnType<typeof useDaily>;

// ── Health sentence (/api/status via the daily digest) ──

function HealthSection({ daily }: { daily: DailyState }) {
  if (daily.isLoading) {
    return (
      <section aria-labelledby="today-health-heading" className="space-y-3">
        <TodayHeading />
        <p className="flex items-center gap-2 text-[var(--pw-color-text-muted)]">
          <Loader2 size={16} aria-hidden={true} className="loader-static" />
          Checking your world…
        </p>
      </section>
    );
  }
  if (daily.isError) {
    return (
      <ErrorState
        title="Today"
        failed="could not load your daily digest"
        detail={detailOf(daily.error)}
        onRetry={() => void daily.refetch()}
      />
    );
  }
  const result = daily.data;
  if (!result) return null;
  if (!result.ok) {
    return (
      <section aria-labelledby="today-health-heading" className="space-y-3">
        <TodayHeading />
        <p className="text-[var(--pw-color-text-primary)]">
          Some current details are unavailable. Your journal and saved world are still here.
        </p>
      </section>
    );
  }

  const caps = Object.entries(result.data?.capabilities ?? {});
  const healthy = caps.filter(([, c]) => c.status === "healthy").length;
  const actionable = caps.filter(([, c]) =>
    ["warning", "needs_attention", "unavailable", "stale"].includes(c.status)
  ).length;
  const uncertain = caps.filter(([, c]) => c.status === "unknown").length;
  const vacant = caps.filter(([, c]) => c.status === "not_configured").length;

  let sentence: string;
  let wellbeing: string;
  if (caps.length === 0) {
    sentence = "Your world is ready. Nothing is connected yet.";
    wellbeing = "Your world is ready.";
  } else if (vacant === caps.length) {
    // A fresh install where nothing is connected is a valid, non-error
    // state (NATIVE-BASELINE-AND-ENRICHMENT) — it is "ready", not "0
    // are healthy".
    sentence =
      "Your world is ready. Nothing is connected yet — capabilities will show up here as you add them.";
    wellbeing = "Your world is ready.";
  } else if (actionable > 0) {
    sentence =
      `${actionable} ${actionable === 1 ? "thing needs" : "things need"} a look. ` +
      `${healthy} ${healthy === 1 ? "capability is" : "capabilities are"} healthy.`;
    wellbeing = `${actionable} ${actionable === 1 ? "thing needs" : "things need"} a look.`;
  } else if (uncertain > 0) {
    sentence =
      `Nothing urgent, but ${uncertain} ` +
      `${uncertain === 1 ? "capability has" : "capabilities have"} not been checked yet. ` +
      `${healthy} ${healthy === 1 ? "is" : "are"} healthy.`;
    wellbeing = "Your world is mostly quiet.";
  } else {
    sentence =
      `Nothing urgent. ${healthy} ${healthy === 1 ? "capability is" : "capabilities are"} healthy` +
      (vacant > 0 ? `, and ${vacant} are waiting until you need them.` : ".");
    wellbeing = "Your world is running well.";
  }

  const detailBits: string[] = [];
  if (healthy > 0) {
    detailBits.push(
      `${healthy} connected ${healthy === 1 ? "capability" : "capabilities"} healthy`
    );
  }
  detailBits.push(`${actionable} attention`);
  if (vacant > 0) {
    detailBits.push(`${vacant} not configured`);
  }

  return (
    <section aria-labelledby="today-health-heading" className="space-y-3">
      {/* Phone form (17:1937): greeting + health chip live on the warm
          fade band (index.css, ≤599px); desktop (17:481) keeps the
          flat canvas. */}
      <div className="pw-today-greeting-band space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <TodayHeading />
          <div
            data-pw-today-health-chip
            className="rounded-2xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2.5 sm:rounded-3xl sm:px-[22px] sm:py-[18px]"
          >
            <div className="flex items-center justify-between gap-[10px]">
              <p className="text-[13px] text-[var(--pw-color-text-secondary)] sm:text-lg sm:text-[var(--pw-color-text-primary)]"
                style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
              >
                {wellbeing}
              </p>
              <Sparkles size={16} aria-hidden={true} className="shrink-0 text-[var(--pw-color-accent-primary)]" />
            </div>
            <p className="hidden text-[13px] text-[var(--pw-color-text-secondary)] min-[600px]:mt-2 min-[600px]:block">
              {detailBits.join("  ·  ")}
            </p>
          </div>
        </div>
        <p className="text-lg text-[var(--pw-color-text-primary)]">{sentence}</p>
      </div>
    </section>
  );
}

// ── Attention (/api/daily attention) — quiet state = companion message ──

/** The quiet-day block (frame 17:522): a static warm gradient panel —
 * teal edge fading through rose into the canvas — carrying the frame's
 * exact message and the canonical companion rig (audit reservation
 * mermaid-art: the design's illustrated Mermaid normalizes to the
 * repository artwork via CompanionSlot; artwork is aria-hidden and
 * absent entirely when the companion pref is off, A11y §7.4). The
 * frame's settle gesture (17:583) sits beneath the presence — the
 * world settling, decoration only. No motion, no glow animation —
 * stillness is the design. */
function QuietDayMessage() {
  return (
    <div
      data-pw-today-quiet
      className="relative flex flex-col items-start gap-4 overflow-hidden rounded-3xl px-[22px] py-[18px] sm:gap-6 sm:px-[38px] sm:py-[30px] sm:min-h-[240px] sm:flex-row sm:items-center"
      style={{
        backgroundImage: "var(--pw-color-warmth-quiet-gradient)",
        boxShadow: "var(--pw-color-warmth-quiet-glow)",
      }}
    >
      {/* Phone form (17:1940-42): a small avatar presence beside the
          message, in the rose circle; desktop (17:522) keeps the full
          64px Empty-State rig. Same decorative contract: aria-hidden,
          removed by the companion-off pref (A11y §7.4). */}
      <div
        aria-hidden={true}
        className="flex size-[28px] shrink-0 items-center justify-center rounded-full sm:hidden"
        style={{ backgroundColor: "var(--pw-color-warmth-rose-tint)" }}
      >
        <CompanionSlot size="micro" />
      </div>
      <div className="hidden shrink-0 self-center sm:block">
        <CompanionSlot size="empty" />
      </div>
      {/* The frame's settle gesture (17:583) sits beneath the presence,
          clipped by the panel's bottom edge exactly as exported. With
          the canonical 64px rig (vs the frame's 150px illustration) it
          centers under the artwork column. */}
      <img
        src="/today/settle-gesture.svg"
        alt=""
        aria-hidden="true"
        width={90}
        height={29}
        className="pointer-events-none absolute bottom-[-6px] left-[-16px] hidden sm:block"
      />
      <div className="space-y-[9px] sm:space-y-[13px]">
        <p
          className="text-[14px] leading-[1.45] text-[var(--pw-color-text-secondary)] italic sm:text-[29px] sm:leading-[1.2] sm:not-italic sm:text-[var(--pw-color-text-primary)]"
          style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
        >
          Nothing needs you right now.
        </p>
        <p className="max-w-[690px] text-sm leading-[1.5] text-[var(--pw-color-text-secondary)] sm:text-base sm:leading-[1.6]">
          Your world is running on its own. You can check on it anytime.
        </p>
      </div>
    </div>
  );
}

// ── Bad Day triage (Workshop v3 frame 17:2117 "Today — Bad Day",
//    ATTENTIVE register) ──

/** The Figma frame's "What needs you now" items carry a
 *  "capability · issue" headline and a suggested-action pill.
 *  We parse the real attention string to surface the same shape. */
function triageItemOf(warning: string): { capability: string; detail: string } | null {
  const match = CAPABILITY_WARNING_SHAPE.exec(String(warning || ""));
  if (!match) return null;
  return { capability: match[1], detail: match[2] };
}

/** Bad day items are actionable attention — not uncertainty-only.
 *  Uncertainty is curiosity, not a bad day. */
function badDayItems(items: string[]): { actionable: string[]; informational: string[] } {
  const actionable: string[] = [];
  const informational: string[] = [];
  for (const item of items) {
    const parsed = triageItemOf(item);
    if (parsed && QUESTION_STATUSES.has(parsed.detail.trim())) {
      informational.push(item);
    } else {
      actionable.push(item);
    }
  }
  return { actionable, informational };
}

/** Tier 1 — "What needs you now" (frame 17:2161): rose-bordered panel
 *  with attention items and companion note. The companion's restrained
 *  message matches the frame: "I'll keep watching this." */
function BadDayTriage({ items }: { items: string[] }) {
  const { actionable, informational } = badDayItems(items);
  if (actionable.length < 2) return null;
  return (
    <section
      aria-labelledby="today-bad-day-heading"
      className="space-y-4"
      data-pw-today-bad-day=""
    >
      {/* Tier 1: What needs you now */}
      <div
        className="flex gap-5 overflow-hidden rounded-3xl p-5"
        style={{
          backgroundColor: "var(--pw-color-surface-panel)",
          border: "1px solid var(--pw-color-accent-secondary)",
          borderLeft: "4px solid var(--pw-color-accent-secondary)",
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2
                id="today-bad-day-heading"
                className="text-xl"
                style={{ fontFamily: "var(--pw-typography-font-expressive)", color: "var(--pw-color-text-primary)" }}
              >
                What needs you now
              </h2>
              <p className="text-xs" style={{ color: "var(--pw-color-text-secondary)" }}>
                {actionable.length === 2
                  ? "Two things could use your attention."
                  : `${actionable.length} things could use your attention.`}
              </p>
            </div>
            <span
              className="text-[11px] uppercase"
              style={{ color: "var(--pw-color-accent-secondary)" }}
            >
              Needs attention
            </span>
          </div>
          <ul className="space-y-2" role="list">
            {actionable.map((item, i) => (
              <li key={`${i}-${item}`}>
                <div
                  className="flex items-center gap-3.5 rounded-xl px-4 py-3.5"
                  style={{ backgroundColor: "var(--pw-color-surface-elevated)" }}
                >
                  <div
                    className="flex size-[38px] shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "var(--pw-color-warmth-rose-wash-soft)" }}
                  >
                    <AlertCircle size={19} aria-hidden={true} style={{ color: "var(--pw-color-accent-secondary)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: "var(--pw-color-text-primary)" }}>
                      {humanizeAttention(item)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full border px-3 py-2 text-xs"
                    style={{
                      borderColor: "var(--pw-color-accent-secondary)",
                      color: "var(--pw-color-accent-secondary)",
                    }}
                  >
                    Review
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {/* Companion note (17:2184): restrained presence beside the
            triage — the companion watches, not acts. */}
        <div className="hidden w-[178px] shrink-0 flex-col items-center justify-center self-stretch sm:flex">
          <div className="flex items-center justify-center">
            <CompanionSlot size="empty" />
          </div>
          <p className="mt-2 opacity-55" style={{ color: "var(--pw-color-accent-primary)" }}>
            <span aria-hidden="true">✦</span>
          </p>
          <p
            className="mt-1 text-center text-[15px] italic"
            style={{ fontFamily: "var(--pw-typography-font-expressive)", color: "var(--pw-color-text-secondary)" }}
          >
            "I'll keep watching this."
          </p>
        </div>
      </div>

      {/* Tier 2: Good to know — no action needed (17:2188) */}
      {informational.length > 0 ? (
        <div
          className="flex flex-col gap-3.5 overflow-hidden rounded-3xl p-5"
          style={{
            backgroundColor: "var(--pw-color-surface-panel)",
            border: "1px solid var(--pw-color-border-subtle)",
            borderLeft: "3px solid var(--pw-color-accent-primary)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--pw-typography-font-expressive)", color: "var(--pw-color-text-primary)" }}
            >
              Good to know — no action needed
            </h2>
            <span
              className="text-[11px] uppercase"
              style={{ color: "var(--pw-color-accent-primary)" }}
            >
              Watching quietly
            </span>
          </div>
          <div className="grid gap-3.5 min-[900px]:grid-cols-2">
            {informational.map((item, i) => (
              <div
                key={`${i}-${item}`}
                className="flex items-center gap-3.5 rounded-2xl p-4"
                style={{ backgroundColor: "var(--pw-color-warmth-teal-wash)" }}
              >
                <div
                  className="flex size-[38px] shrink-0 items-center justify-center rounded-full"
                  style={{ border: "1px solid var(--pw-color-accent-primary)" }}
                >
                  <Inbox size={18} aria-hidden={true} style={{ color: "var(--pw-color-accent-primary)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: "var(--pw-color-text-primary)" }}>
                    {humanizeAttention(item)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Reassurance (17:2205/17:2215): the frame's "Waiting for help"
          section carries this message — the triage ends with warmth. */}
      <div
        className="flex items-center gap-4 overflow-hidden rounded-3xl p-5"
        style={{
          backgroundColor: "var(--pw-color-surface-elevated)",
          border: "1px solid var(--pw-color-border-subtle)",
          borderLeft: "3px solid var(--pw-color-accent-secondary)",
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--pw-color-text-secondary)" }}>
          This isn't broken. It's waiting for you when you're ready.
        </p>
      </div>
    </section>
  );
}

function AttentionSection({ daily }: { daily: DailyState }) {
  if (daily.isLoading || daily.isError || !daily.data?.ok) return null;
  const items = daily.data.data?.attention ?? [];
  if (items.length === 0) {
    // The quiet state IS the design's centerpiece (17:522): the world
    // says plainly that nothing is needed. No heading, no icon, no
    // invented tasks — quiet is a feature, and the section keeps a
    // labeled region for structure without shouting.
    return (
      <section
        aria-label="Your world today"
        className="pt-[var(--pw-spacing-section)]"
      >
        <QuietDayMessage />
      </section>
    );
  }
  // Question state (17:6245): attention made ONLY of uncertainty
  // (capability status "unknown") renders the curious-companion
  // question region — uncertainty is not failure, so it gets curiosity,
  // not alarm chrome. Anything actionable in the mix keeps the
  // restrained list (importance ≠ urgency ≠ volume; a real problem is
  // never softened into a question).
  const allUncertainty = items.every((item) => {
    const parsed = questionItemOf(item);
    return parsed !== null && QUESTION_STATUSES.has(parsed.detail.trim());
  });
  if (allUncertainty) {
    return (
      <section
        aria-label="Your world today"
        className="pt-[var(--pw-spacing-section)]"
      >
        <QuestionRegion
          items={items}
          caps={daily.data.data?.capabilities ?? {}}
        />
      </section>
    );
  }
  // Bad Day state (17:2117): multiple actionable attention items render
  // the triage hierarchy — "What needs you now" + "Good to know" +
  // reassurance. The companion stays at restrained volume; the world
  // doesn't panic, it triages warmly.
  const { actionable } = badDayItems(items);
  if (actionable.length >= 2) {
    return (
      <section
        aria-label="Your world today"
        className="pt-[var(--pw-spacing-section)]"
      >
        <BadDayTriage items={items} />
      </section>
    );
  }
  return (
    <section
      aria-labelledby="today-attention-heading"
      className="space-y-3 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]"
    >
      <h2
        id="today-attention-heading"
        className="flex items-center gap-2 text-lg font-semibold"
        style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
      >
        <AlertCircle size={18} aria-hidden={true} />
        Attention
      </h2>
      <ul className="space-y-2" role="list">
        {items.slice(0, 5).map((item, i) => (
          <li key={`${i}-${item}`} className="text-[var(--pw-color-text-primary)]">
            {humanizeAttention(item)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The daily loop's "available: X (Y) — not enabled for writes"
 * strings are capability-speak; this is the one shape both Attention
 * and What changed humanize (mirroring legacy api.py
 * humanizeAttention) so the same data reads the same way everywhere. */
const AVAILABLE_NOT_ENABLED_FOR_WRITES =
  /^available: .+ \(([^)]+)\) — not enabled for writes$/;

/** Attention strings run through the humanizing voice: "available:"
 * actions read as opportunities, not faults. */
function humanizeAttention(value: string): string {
  const text = String(value || "");
  const available = text.match(AVAILABLE_NOT_ENABLED_FOR_WRITES);
  const human = available
    ? `${available[1].replaceAll("_", " ")} is ready for looking, not changing things.`
    : text.replaceAll("_", " ");
  return human.charAt(0).toUpperCase() + human.slice(1);
}

// ── Question state (Workshop v3 frame 17:6245 "Today — Question",
//    AMBIENT → ATTENTIVE / CURIOUS) ──

/** The digest's warning shape is `"{capability}: {status}"` (loop.py
 * OBSERVE+VALIDATE). The Question state is for UNCERTAINTY-shaped
 * attention: a capability whose observation came back unknown — the
 * world noticed something but cannot say what it means yet. Warnings
 * with a canonical uncertainty status render here; plain
 * unavailable/degraded warnings stay in the restrained list (a broken
 * thing is a fact, not a question; importance ≠ urgency ≠ volume). */
const QUESTION_STATUSES = new Set(["unknown"]);

const CAPABILITY_WARNING_SHAPE = /^([a-z0-9_]+): (.+)$/;

function questionItemOf(warning: string): { capability: string; detail: string } | null {
  const match = CAPABILITY_WARNING_SHAPE.exec(String(warning || ""));
  if (!match) return null;
  return { capability: match[1], detail: match[2] };
}

/** The frame's curious posture (17:6290-92): companion beside the
 * accent-ruled message. Canonical rig via CompanionSlot (mermaid-art
 * reservation — presence-scale conflict unchanged, recorded); the
 * frame's "· ✦ / ✧" motes normalize to one aria-hidden spark. */
function QuestionRegion({
  items,
  caps,
}: {
  items: string[];
  caps: DailyData["capabilities"];
}) {
  const parsed = items
    .map((w) => questionItemOf(w))
    .filter((x): x is { capability: string; detail: string } => x !== null)
    .filter((x) => QUESTION_STATUSES.has(x.detail.trim()));
  if (parsed.length === 0) return null;
  const [first] = parsed;
  const cap = caps[first.capability];
  const seen: string[] = [];
  if (cap?.warnings?.length) seen.push(...cap.warnings);
  const observed = ageText(cap?.last_observed ?? "");

  return (
    <section
      data-pw-today-question
      aria-labelledby="today-question-heading"
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7"
    >
      <div className="shrink-0 self-center">
        <CompanionSlot size="empty" />
      </div>
      <div className="flex flex-1 items-start gap-[22px]">
        <span
          aria-hidden="true"
          className="w-[3px] shrink-0 self-stretch rounded-full bg-[var(--pw-color-accent-primary)]"
        />
        <div className="flex-1 space-y-[13px] py-2">
          <div className="flex items-center gap-[10px]">
            <Clock size={18} aria-hidden={true} className="text-[var(--pw-color-accent-primary)]" />
            <h2
              id="today-question-heading"
              className="text-2xl text-[var(--pw-color-text-primary)]"
              style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
            >
              Something caught my attention.
              <span aria-hidden="true"> ✦</span>
            </h2>
          </div>
          <p className="text-[15px] leading-[1.5] text-[var(--pw-color-text-primary)]">
            {parsed.length === 1
              ? `${first.capability.replaceAll("_", " ")} has not been checked yet, so its state is unknown.`
              : `${parsed.length} capabilities have not been checked yet, so their state is unknown.`}
          </p>
          <p className="text-sm leading-[1.5] text-[var(--pw-color-text-secondary)]">
            I'll keep watching. It might resolve on its own.
          </p>
          <p
            className="text-[13px] text-[var(--pw-color-accent-primary)]"
            style={{ fontStyle: "italic" }}
          >
            This isn't a problem yet — just something I noticed.
          </p>
          {/* Evidence chip (17:6302-04): the world shows WHAT it can
              actually see — real warnings + honest observation age,
              behind the Level-4 disclosure (A11y §4.6). Never invented
              (row 15: no fabricated evidence lines). */}
          {seen.length > 0 || observed !== "unknown" ? (
            <Disclosure summary="✦ What I can see" level={4}>
              <div className="space-y-1 pt-1">
                {seen.map((line, i) => (
                  <p key={i} className="text-xs text-[var(--pw-color-text-secondary)]">
                    {line}
                  </p>
                ))}
                {observed !== "unknown" ? (
                  <p className="text-xs text-[var(--pw-color-text-secondary)]">
                    Last observed {observed} ago.
                  </p>
                ) : null}
              </div>
            </Disclosure>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** What changed renders the "available:" shape through the same voice
 * as Attention; every other recorded line keeps its exact content. */
function humanizeWhatChanged(value: string): string {
  const text = String(value || "");
  return AVAILABLE_NOT_ENABLED_FOR_WRITES.test(text) ? humanizeAttention(text) : text;
}

// ── Projects (agent-sync estate; only meaningful state) ──

/** Today tells Rylee what matters, not every repository: attention
 *  projects get a sentence; local work gets one calm mention; a
 *  settled estate gets one settled line; an unavailable sensor is
 *  one quiet sentence (Today must not become a status board). */
function ProjectsTodaySection() {
  const query = useAgentSyncProjects();
  if (query.isLoading && !query.data) return null; // no flash of empty state
  if (query.isError || query.data?.ok !== true || !query.data.data) {
    return null; // Today stays calm; Projects owns the detail + degradation copy
  }
  const data = query.data.data;
  const projects = data.projects ?? [];
  if (projects.length === 0) return null;

  const attention = projects
    .filter((p) => NEEDS_ATTENTION.includes(projectCategory(p)))
    .sort((a, b) =>
      CATEGORY_ORDER[projectCategory(a)] - CATEGORY_ORDER[projectCategory(b)]);
  const localWork = projects.filter((p) => projectCategory(p) === "local_work");
  const unknown = projects.filter((p) => projectCategory(p) === "unknown");
  // Observation age — ONE quiet line, ONLY when stale. Fresh
  // observations add no ink to Today (quiet-when-healthy); stale is
  // provenance, never alarm vocabulary. Missing/invalid timestamp ->
  // no line (an unknowable age is not a stale age).
  const age = observationAge(data.observed_at);

  if (attention.length === 0 && localWork.length === 0 && unknown.length === 0) {
    return (
      <section aria-labelledby="today-projects-heading" className="space-y-1 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]">
        <h2 id="today-projects-heading" className="text-lg font-semibold" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
          Projects
        </h2>
        <p className="text-[var(--pw-color-text-secondary)]">
          Projects are quiet.
        </p>
        {age.stale ? (
          <p className="text-[var(--pw-color-text-secondary)]" data-pw-today-projects="stale">
            {`Project status may be out of date — last observed ${age.text} ago.`}
          </p>
        ) : null}
      </section>
    );
  }

  const bits: string[] = [];
  if (attention.length > 0) {
    bits.push(
      attention.length === 1
        ? "1 needs attention"
        : `${attention.length} need attention`
    );
  }
  if (localWork.length > 0) {
    bits.push(
      localWork.length === 1
        ? "1 has local work"
        : `${localWork.length} have local work`
    );
  }
  if (unknown.length > 0) {
    bits.push(
      unknown.length === 1
        ? "1 could not reach its remote"
        : `${unknown.length} could not reach their remotes`
    );
  }

  return (
    <section aria-labelledby="today-projects-heading" className="space-y-1 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]">
      <h2 id="today-projects-heading" className="text-lg font-semibold" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
        Projects
      </h2>
      <p className="text-[var(--pw-color-text-primary)]">{bits.join(" · ")}</p>
      {attention.length > 0 ? (
        <ul className="space-y-1 text-sm" role="list" data-pw-today-projects="attention">
          {attention.slice(0, 3).map((p) => (
            <li key={p.project}>
              {projectSentence(p)}{" "}
              <Link to="/projects" className="underline decoration-[var(--pw-color-border-subtle)] underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2 rounded-sm">
                See Projects
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {attention.length > 3 ? (
        <p className="text-sm text-[var(--pw-color-text-secondary)]">
          and {attention.length - 3} more in Projects.
        </p>
      ) : null}
      {age.stale ? (
        <p className="text-[var(--pw-color-text-secondary)]" data-pw-today-projects="stale">
          {`Project status was last observed ${age.text} ago.`}
        </p>
      ) : null}
    </section>
  );
}

// ── Activity panels (frames 17:533 / 17:546) ──

/** Shared panel treatment for real activity: surface-panel box with the
 * frame's radius/padding and a static resting shadow. The design's
 * per-entry tints in the frame have no token equivalent —
 * --pw-color-surface-elevated is the canonical nearest (mapping ledger
 * #4); ad-hoc hexes never enter components. */
function ActivityPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] p-[28px] ${className}`}
      style={{ boxShadow: "var(--pw-color-warmth-panel-shadow)" }}
    >
      {children}
    </div>
  );
}

/** Panel section title (17:535): canonical icon + Young Serif 24px. */
function PanelTitle({
  id,
  icon,
  children,
}: {
  id: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-[10px] text-2xl"
      style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
    >
      {icon}
      {children}
    </h2>
  );
}

// ── What changed (/api/daily actions; ABSENT on a quiet day) ──

function WhatChangedSection({ daily }: { daily: DailyState }) {
  const changed = daily.data?.actions ?? [];
  const digestOk = daily.data?.ok === true;
  if (!digestOk || changed.length === 0) {
    // A quiet day shows NO "what changed" list — parity row 15: no
    // fabricated content, the section simply does not exist. The frame
    // (17:533) depicts a day with recorded actions; the panel design
    // applies only to real ones (behavior outranks literal visuals).
    return null;
  }
  return (
    <section
      aria-labelledby="today-changes-heading"
      className="h-full pt-0"
    >
      <ActivityPanel className="h-full">
        <div className="space-y-4">
          <PanelTitle
            id="today-changes-heading"
            icon={<Clock size={20} aria-hidden={true} className="text-[var(--pw-color-accent-primary)]" />}
          >
            Recent Changes
          </PanelTitle>
          <ul className="space-y-[2px] sm:space-y-[2px]" role="list">
            {changed.slice(0, 5).map((item, i) => (
              <li
                key={`${i}-${item}`}
                className="flex items-start gap-[10px] border-b border-[var(--pw-color-border-subtle)] py-3 text-[13px] leading-[1.45] text-[var(--pw-color-text-secondary)] last:border-b-0 sm:items-center sm:gap-[14px] sm:py-[18px] sm:text-[15px] sm:text-[var(--pw-color-text-primary)]"
              >
                {/* Phone form (17:1958): the dot becomes the frame's
                    28px teal-tint icon frame; desktop keeps the dot. */}
                <span
                  aria-hidden="true"
                  className="flex size-[28px] shrink-0 items-center justify-center rounded-[10px] min-[600px]:size-[9px] min-[600px]:rounded-full"
                  style={{
                    backgroundColor: "var(--pw-color-warmth-teal-tint)",
                  }}
                >
                  <Clock size={15} aria-hidden={true} className="text-[var(--pw-color-accent-primary)] min-[600px]:hidden" />
                </span>
                <span className="min-w-0 flex-1">{humanizeWhatChanged(item)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--pw-color-text-secondary)]">
            The machinery is humming quietly beneath the surface.
          </p>
        </div>
      </ActivityPanel>
    </section>
  );
}

// ── Journal composer + recent entries (/api/journal) ──

function JournalSection({
  journal,
  onSaved,
}: {
  journal: ReturnType<typeof useJournalPage>;
  onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const text = note.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveJournalEntry(text);
      setNote("");
      onSaved();
    } catch (e) {
      setError(
        e instanceof ApiError && e.detail
          ? e.detail
          : "That note did not save. It is still in the box so you can try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const recent = useMemo(() => {
    const events = journal.data ?? [];
    // Mirror legacy: capability self-observations are loop noise, not
    // the person's day (api.py renderToday filters "capability …").
    const source = events.filter(
      (event) => !String(event.summary || "").toLowerCase().startsWith("capability ")
    );
    const seen = new Set<string>();
    const picked: JournalEntry[] = [];
    for (const event of [...source].reverse()) {
      const summary = eventSummary(event);
      if (seen.has(summary)) continue;
      seen.add(summary);
      picked.push(event);
      if (picked.length === 5) break;
    }
    return picked;
  }, [journal.data]);

  return (
    <section
      aria-labelledby="today-journal-heading"
      className="h-full pt-0"
    >
      <ActivityPanel className="h-full">
        <div className="space-y-5">
          <div className="space-y-2">
            <PanelTitle
              id="today-journal-heading"
              icon={<BookOpen size={20} aria-hidden={true} className="text-[var(--pw-color-accent-primary)]" />}
            >
              Recent Journal
            </PanelTitle>
            <p className="text-sm text-[var(--pw-color-text-muted)]">
              Leave yourself a note about today.
            </p>
          </div>
          <label htmlFor="today-journal-note" className="sr-only">
            Journal note
          </label>
          <textarea
            id="today-journal-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened? What did you notice?"
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded-2xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-canvas)] p-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <div className="flex items-center justify-between gap-3">
            <Button type="button" onClick={() => void save()} disabled={!note.trim() || saving}>
              Save entry
            </Button>
            <span className="text-sm text-[var(--pw-color-text-muted)]" role="status">
              {error ?? (saving ? "Saving…" : "")}
            </span>
          </div>

          {journal.isLoading ? (
            <p className="flex items-center gap-2 text-[var(--pw-color-text-muted)]">
              <Loader2 size={16} aria-hidden={true} className="loader-static" />
              Opening your journal…
            </p>
          ) : journal.isError ? (
            <p className="text-[var(--pw-color-text-primary)]">
              Your journal could not be opened just now. Your note box is unaffected.
            </p>
          ) : recent.length === 0 ? (
            <p className="text-[var(--pw-color-text-secondary)]">
              No journal entries yet. This is a gentle place to begin.
            </p>
          ) : (
            <ul className="space-y-3" role="list" aria-label="Recent entries">
              {recent.map((entry, i) => (
                <li
                  key={`${entry.ts}-${i}`}
                  className="flex items-center gap-[14px] rounded-2xl bg-[var(--pw-color-surface-elevated)] px-[18px] py-[17px] max-[599px]:items-stretch max-[599px]:gap-0 max-[599px]:rounded-none max-[599px]:bg-transparent max-[599px]:px-0 max-[599px]:py-[7px]"
                  style={{ borderLeft: "2px solid var(--pw-color-accent-secondary)" }}
                >
                  {/* Phone form (17:1972-76): rose left-border entries —
                      expressive 14px summary, rose 12px time; desktop
                      keeps the elevated chip + dot. */}
                  <span
                    aria-hidden="true"
                    className="size-[9px] shrink-0 rounded-full bg-[var(--pw-color-accent-secondary)] opacity-80 max-[599px]:hidden"
                  />
                  <div className="min-w-0 flex-1 space-y-[5px] max-[599px]:pl-3">
                    <p
                      className="text-base text-[var(--pw-color-text-primary)] max-[599px]:text-[14px]"
                      style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
                    >
                      {eventSummary(entry)}
                    </p>
                    <p
                      className="text-xs max-[599px]:text-[12px] max-[599px]:italic max-[599px]:text-[var(--pw-color-text-secondary)]"
                      style={{ color: "var(--pw-color-accent-secondary)" }}
                    >
                      <time dateTime={entry.ts}>{eventTime(entry.ts)}</time>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link to="/journal" className="pw-nav-link inline-flex">
              View all in Journal
            </Link>
          </p>
        </div>
      </ActivityPanel>
    </section>
  );
}

// ── More from your world: Services, Subscription usage, Capabilities ──

type LabRow = {
  row: string;
  count: number;
  stale?: boolean;
  observations: Array<{ detail: string; action?: string | null; state?: string; observed_at?: string }>;
};

/** useLabState unwraps the Result envelope: lab.data IS the packet
 * ({rows, schema, generated_at}); a failed packet yields
 * {rows: [], reason} (api.py lab_state). */
type LabPacket = { rows?: LabRow[]; reason?: string; schema?: string; generated_at?: string };

function MoreFromWorld({
  daily,
  apps,
  lab,
  stepUp,
  announce,
}: {
  daily: DailyState;
  apps: ReturnType<typeof useApps>;
  lab: ReturnType<typeof useLabState>;
  stepUp: ReturnType<typeof useStepUp>;
  announce: ReturnType<typeof useAnnounce>["announce"];
}) {
  const caps = Object.entries(daily.data?.data?.capabilities ?? {});

  return (
    <section
      aria-labelledby="today-more-heading"
      className="space-y-4 border-t border-[var(--pw-color-border-subtle)] pt-[var(--pw-spacing-section)]"
    >
      <h2 id="today-more-heading" className="sr-only">
        More from your world
      </h2>
      <Disclosure summary="More from your world" level={2}>
        <div className="space-y-4 pt-2">
          <ServicesPanel apps={apps} stepUp={stepUp} announce={announce} />
          <SubscriptionPanel lab={lab} />
          <CapabilitiesPanel caps={caps} digestOk={daily.data?.ok === true} />
        </div>
      </Disclosure>
    </section>
  );
}

function ServicesPanel({
  apps,
  stepUp,
  announce,
}: {
  apps: ReturnType<typeof useApps>;
  stepUp: ReturnType<typeof useStepUp>;
  announce: ReturnType<typeof useAnnounce>["announce"];
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  const add = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) {
      setStatus("Add both a name and an address.");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported");
    } catch {
      setStatus("Use a complete http or https address.");
      return;
    }
    const current = Array.isArray(apps.data) ? apps.data : [];
    const next: ServiceApp[] = [
      ...current,
      {
        id: trimmedName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        name: trimmedName,
        url: parsed.toString(),
      },
    ];
    setAdding(true);
    setStatus("Adding…");
    try {
      await stepUp.withStepUp(() => saveApps(next));
      setName("");
      setUrl("");
      setStatus("Service added.");
      announce("Service added to your launcher.", { kind: "action_completed", key: "today-service-added" });
      await apps.refetch();
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setStatus("Add cancelled — the service was not added.");
      } else {
        setStatus("That service was not added. Check the address and try again.");
      }
    } finally {
      setAdding(false);
    }
  };

  const services = Array.isArray(apps.data) ? apps.data : [];

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Services</h3>
      {apps.isLoading ? (
        <p className="text-[var(--pw-color-text-muted)]">Opening your services…</p>
      ) : apps.isError ? (
        <p className="text-[var(--pw-color-text-primary)]">
          Saved services could not be opened. You can try again later.
        </p>
      ) : services.length === 0 ? (
        <p className="text-[var(--pw-color-text-secondary)]">
          No services saved here yet. Add one when it would be useful.
        </p>
      ) : (
        <ul className="space-y-1" role="list">
          {services.map((app, i) => (
            <li key={`${app.id}-${i}`}>
              <a href={app.url} rel="noopener noreferrer" className="pw-nav-link inline-flex">
                {app.name || app.id}
                {app.category ? <span className="text-[var(--pw-color-text-muted)]"> — {app.category}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-xl border border-[var(--pw-color-border-subtle)] p-3">
        <label htmlFor="svc-name" className="sr-only">
          Service name
        </label>
        <input
          id="svc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Service name"
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <label htmlFor="svc-url" className="sr-only">
          Service address
        </label>
        <input
          id="svc-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <div className="flex items-center justify-between gap-3">
          <Button type="button" onClick={() => void add()} disabled={adding}>
            <Plus size={16} aria-hidden={true} />
            Add service
          </Button>
          <span className="text-sm text-[var(--pw-color-text-muted)]" role="status">
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}

function SubscriptionPanel({ lab }: { lab: ReturnType<typeof useLabState> }) {
  const envelope = lab.data as LabEnvelope | undefined;
  const packet = (envelope?.data ?? undefined) as LabPacket | undefined;
  const rows = packet?.rows ?? [];
  const observations = rows.flatMap((row) => row.observations ?? []);
  const quota = observations.filter((o) => {
    const detail = String(o.detail || "");
    return (
      detail.includes("credit balance") ||
      detail.includes("/used ") ||
      (detail.includes("window") && detail.includes("%") && detail.includes("resets"))
    );
  });
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Subscription usage</h3>
      {lab.isLoading ? (
        <p className="text-[var(--pw-color-text-muted)]">Checking usage…</p>
      ) : lab.isError ? (
        <p className="text-[var(--pw-color-text-primary)]">
          Usage details are unavailable right now. Everything else still works.
        </p>
      ) : quota.length === 0 ? (
        <p className="text-[var(--pw-color-text-secondary)]">
          No current subscription limits need your attention.
        </p>
      ) : (
        <ul className="space-y-1" role="list">
          {quota.slice(0, 5).map((o, i) => (
            <li key={i} className="text-[var(--pw-color-text-primary)]">
              {o.detail || "Usage observation"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Statuses that never deserve an individual row at Level 1: the
 * healthy majority and the not-yet-connected (Finish Line: "healthy
 * systems stay quiet"). Everything else — warning,
 * needs_attention, unavailable, stale, unknown, disabled — surfaces
 * as its own row so problems stay visible. */
const QUIET_CAPABILITY_STATUSES = new Set(["healthy", "not_configured"]);

function CapabilitiesPanel({
  caps,
  digestOk,
}: {
  caps: Array<[string, { ok: boolean; status: string; warnings: string[]; last_observed: string }]>;
  digestOk: boolean;
}) {
  const surfaced = caps.filter(([, cap]) => !QUIET_CAPABILITY_STATUSES.has(cap.status));
  const quiet = caps.filter(([, cap]) => QUIET_CAPABILITY_STATUSES.has(cap.status));
  const quietLine =
    `${quiet.length} ${surfaced.length > 0 ? "other " : ""}` +
    `${quiet.length === 1 ? "capability is" : "capabilities are"} healthy or not yet connected.`;
  const quietSummary =
    quiet.length === 1 ? "Show the other one" : `Show the other ${quiet.length}`;
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Capabilities</h3>
      {!digestOk ? (
        <p className="text-[var(--pw-color-text-secondary)]">
          Capabilities could not be checked just now. Your journal and saved world are still available.
        </p>
      ) : caps.length === 0 ? (
        <p className="text-[var(--pw-color-text-secondary)]">No capabilities defined.</p>
      ) : (
        <div className="space-y-2">
          {surfaced.length > 0 ? (
            <ul className="space-y-2" role="list">
              {surfaced.map(([name, cap]) => (
                <CapabilityRow key={name} name={name} cap={cap} />
              ))}
            </ul>
          ) : null}
          {quiet.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[var(--pw-color-text-secondary)]">{quietLine}</p>
              <Disclosure summary={quietSummary} level={3}>
                <ul className="space-y-2" role="list">
                  {quiet.map(([name, cap]) => (
                    <CapabilityRow key={name} name={name} cap={cap} />
                  ))}
                </ul>
              </Disclosure>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CapabilityRow({
  name,
  cap,
}: {
  name: string;
  cap: { ok: boolean; status: string; warnings: string[]; last_observed: string };
}) {
  const status = asCanonicalStatus(cap.status);
  return (
    <li>
      <Disclosure summary={name.replaceAll("_", " ")} level={3}>
        <div className="space-y-2 pt-1">
          <StatusChip status={status} />
          {cap.warnings?.length ? (
            <p>{cap.warnings[0]}</p>
          ) : (
            <p>Observed {ageText(cap.last_observed)} ago.</p>
          )}
          <TechnicalDetails
            provider={`capability: ${name}`}
            raw={JSON.stringify({ status: cap.status, ok: cap.ok })}
          />
        </div>
      </Disclosure>
    </li>
  );
}

function ageText(value: string): string {
  const dt = new Date(value);
  if (!value || Number.isNaN(dt.getTime())) return "unknown";
  const mins = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h`;
  return `${Math.floor(mins / 1440)} d`;
}

function detailOf(error: Error | null): string | null {
  return error instanceof ApiError ? error.detail : null;
}

// ── Notification card pattern (Workshop v3 frame 17:6369
//    "How the World Tells You Things") ──

export type NotificationTone = "good-news" | "small-update" | "action-required";

export interface NotificationCardProps {
  tone: NotificationTone;
  headline: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const NOTIFICATION_TONE_META: Record<
  NotificationTone,
  { label: string; borderColor: string; glowColor: string; avatarBg: string; avatarIcon: typeof Heart }
> = {
  "good-news": {
    label: "GOOD NEWS",
    borderColor: "var(--pw-color-accent-primary)",
    glowColor: "var(--pw-color-warmth-teal-tint)",
    avatarBg: "var(--pw-color-accent-primary)",
    avatarIcon: Heart,
  },
  "small-update": {
    label: "A SMALL UPDATE",
    borderColor: "var(--pw-color-text-muted)",
    glowColor: "transparent",
    avatarBg: "var(--pw-color-text-muted)",
    avatarIcon: Bell,
  },
  "action-required": {
    label: "WHEN YOU'RE READY",
    borderColor: "var(--pw-color-accent-secondary)",
    glowColor: "var(--pw-color-warmth-rose-tint)",
    avatarBg: "var(--pw-color-accent-secondary)",
    avatarIcon: AlertCircle,
  },
};

/** NotificationCard (Workshop v3 17:6369): a notification moment card
 *  with three emotional tiers — good news (teal glow), small update
 *  (muted), action-required (rose glow). The world doesn't shout.
 *  It tells you things clearly, warmly, without making you anxious.
 *
 *  Timed notifications auto-dismiss after 8s (caller manages timing).
 *  Action-required notifications persist until dismissed. */
export function NotificationCard({
  tone,
  headline,
  detail,
  actionLabel,
  onAction,
  onDismiss,
}: NotificationCardProps) {
  const meta = NOTIFICATION_TONE_META[tone];
  const AvatarIcon = meta.avatarIcon;
  return (
    <div
      data-pw-notification={tone}
      className="flex items-start gap-3 rounded-[18px] p-3.5"
      style={{
        backgroundColor: "var(--pw-color-surface-elevated)",
        border: `1px solid ${meta.borderColor}`,
        borderLeft: `3px solid ${meta.borderColor}`,
        boxShadow: `0 6px 26px 0 ${meta.glowColor}, var(--pw-color-warmth-panel-shadow)`,
      }}
    >
      <div
        className="flex size-[26px] shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: meta.avatarBg }}
      >
        <AvatarIcon size={20} aria-hidden={true} style={{ color: "var(--pw-color-surface-canvas)" }} />
      </div>
      <div className="min-w-0 flex-1 space-y-[7px]">
        <p className="text-[10px] font-bold" style={{ color: meta.borderColor }}>
          {meta.label}
        </p>
        <p className="text-[13px] leading-[1.35]" style={{ color: "var(--pw-color-text-primary)" }}>
          <span aria-hidden="true">✦</span> {headline}
        </p>
        <p className="text-xs leading-[1.45]" style={{ color: "var(--pw-color-text-secondary)" }}>
          {detail}
        </p>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="text-xs underline decoration-[var(--pw-color-border-subtle)] underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2 rounded-sm"
            style={{ color: meta.borderColor }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="flex size-[var(--pw-target-minimum)] shrink-0 items-center justify-center text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-offset-2 rounded"
      >
        <X size={16} aria-hidden={true} />
      </button>
    </div>
  );
}

export default TodayScreen;
