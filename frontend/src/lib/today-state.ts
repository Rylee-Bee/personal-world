/**
 * Today state projection — §18 State Matrix.
 *
 * "Do not compute Today by taking the 'worst' capability status or
 * searching warning text." Instead, choose the lead composition by
 * human consequence and relevance:
 *
 * 1. A genuinely time-sensitive or materially blocking matter leads.
 * 2. Otherwise, a relevant actionable matter may lead.
 * 3. Otherwise, a meaningful Question or Reservation can lead.
 * 4. Otherwise, allow Quiet.
 *
 * This module determines the PRESENTATION layer — what the person
 * sees — not the underlying domain truth. Domain conditions
 * (healthy, needs_attention, etc.) live in status.py. Knowledge
 * conditions (supported answer, unanswered question) are separate.
 *
 * Important: importance ≠ urgency ≠ volume. A stale observation
 * does not automatically create an Attention composition.
 */

import type { CapabilityHealth } from "./capability-health";

/** The Today compositions, §16.1–16.7. */
export type TodayComposition =
  | "quiet"
  | "question"
  | "reservation"
  | "attention"
  | "degraded"
  | "good_news";

/** Evidence for why a particular composition was chosen. */
export interface TodayEvidence {
  /** The chosen composition. */
  composition: TodayComposition;
  /** Human-readable reason for the choice. */
  reason: string;
  /** Items that contributed to this state (if any). */
  items?: TodayItem[];
}

/** A structured item that can appear on Today. §17 Today assessment seam:
 * "Prefer structured items carrying stable identity, kind, human
 * summary, evidence references, observation times..." */
export interface TodayItem {
  id: string;
  kind: "attention" | "question" | "reservation" | "event" | "good_news";
  /** Human sentence that stands on its own. */
  summary: string;
  /** Source of this item (capability name, project name, etc.) */
  source: string;
  /** When this was observed, if known. */
  observedAt?: string;
  /** Action the person can take. */
  action?: { label: string; target: string };
}

export interface TodayProjectionInput {
  health: CapabilityHealth;
  /** Repo attention items from source control. */
  repoAttention: Array<{ name: string; detail: string }>;
  /** Active agent projects. */
  agentActivity: Array<{ project: string; state: string; branch?: string }>;
  /** Number of active reminders. */
  reminderCount: number;
  /** Whether the daily data loaded successfully. */
  dailyLoaded: boolean;
  /** Warnings from daily loop. */
  dailyWarnings: string[];
}

/**
 * Project the Today composition from available evidence.
 *
 * §18: "Choose the lead composition by human consequence and relevance."
 */
export function projectToday(input: TodayProjectionInput): TodayEvidence {
  const {
    health,
    repoAttention,
    agentActivity,
    reminderCount,
    dailyLoaded,
    dailyWarnings,
  } = input;

  // Build the items list from real observations.
  const items: TodayItem[] = [];

  // Capability attention items — only genuine needs_attention/warning.
  for (const name of health.attention) {
    items.push({
      id: `cap-${name}`,
      kind: "attention",
      summary: `${name} needs your attention.`,
      source: name,
    });
  }

  // Repo attention items.
  for (const repo of repoAttention) {
    items.push({
      id: `repo-${repo.name}`,
      kind: "attention",
      summary: `${repo.name} — ${repo.detail}`,
      source: repo.name,
    });
  }

  // Agent activity items (not attention — just active work).
  for (const agent of agentActivity) {
    items.push({
      id: `agent-${agent.project}`,
      kind: "event",
      summary: `${agent.project} — ${agent.state}`,
      source: agent.project,
    });
  }

  // Capability degradation — unavailable configured capabilities.
  for (const name of health.unavailable) {
    items.push({
      id: `unavail-${name}`,
      kind: "reservation",
      summary: `${name} is currently unavailable.`,
      source: name,
    });
  }

  // Determine composition by human consequence.
  const attentionItems = items.filter((i) => i.kind === "attention");
  const reservationItems = items.filter((i) => i.kind === "reservation");

  // 1. Genuine time-sensitive blocking matter → Attention
  if (attentionItems.length > 0) {
    return {
      composition: "attention",
      reason:
        attentionItems.length === 1
          ? "One thing needs your attention."
          : `${attentionItems.length} things need your attention.`,
      items: attentionItems,
    };
  }

  // 2. Material limitation without blocking → Reservation
  if (reservationItems.length > 0) {
    return {
      composition: "reservation",
      reason:
        reservationItems.length === 1
          ? "One thing is unavailable but your world continues."
          : `${reservationItems.length} things are unavailable but your world continues.`,
      items: reservationItems,
    };
  }

  // 3. No data loaded yet → degraded (loading, not quiet)
  if (!dailyLoaded) {
    return {
      composition: "quiet",
      reason: "Loading your world…",
      items: [],
    };
  }

  // 4. Everything observed, no actionable matters → Quiet
  return {
    composition: "quiet",
    reason:
      health.unavailable.length > 0
        ? "Your world continues. Some things are unavailable."
        : "Nothing needs you right now.",
    items: [],
  };
}
