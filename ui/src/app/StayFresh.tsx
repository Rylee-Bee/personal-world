/**
 * Keeping the app up to date (owner ask, 2026-09-27). The server already
 * makes the browser re-check every file, and the service worker caches
 * nothing; what goes stale is an installed app (iPhone Home Screen) that
 * stays open in memory for days and never reloads.
 *
 * So: know the build this page's code came from, and check /healthz when
 * the page opens, whenever the person comes back to the app, and every few
 * minutes while it's open. When a newer build is live:
 *   - on opening or coming back, it reloads once, unless they're mid-typing;
 *   - otherwise a quiet line says "Worlds was updated" with a Reload
 *     button, and nothing reloads under their hands.
 * The build's own commit is baked in at build time (VITE_PW_COMMIT, from the
 * image's PW_COMMIT build arg). Learning it from the first /healthz instead
 * misses a page whose old code is restored after a deploy (2026-09-27: an
 * old tab showed 3 of 7 needs and no update line). Without a baked commit
 * (local/dev) it falls back to the first /healthz answer.
 * It reloads at most once per live commit (sessionStorage), so a mismatch
 * that a reload can't fix never loops.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { healthz } from "../data/api";

const CHECK_EVERY_MS = 5 * 60_000;
const RELOADED_FOR = "pw-stayfresh-reloaded-for";

/** The commit this code was built from (first 7 chars, as /healthz reports). */
const BUILT: string | null = (import.meta.env.VITE_PW_COMMIT ?? "").slice(0, 7) || null;

/** Reload once per live commit: a second mismatch after reloading means the
 *  reload can't fix it, so show the quiet line instead. */
function reloadedFor(commit: string): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_FOR) === commit) return true;
    sessionStorage.setItem(RELOADED_FOR, commit);
  } catch {
    // No storage: allow the reload; the line is the fallback next time.
  }
  return false;
}

/** True when reloading now could lose something the person typed: a
 *  focused text field, or any text box with words in it. */
function isMidTyping(doc: Document = document): boolean {
  const active = doc.activeElement as HTMLElement | null;
  if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return true;
  return Array.from(doc.querySelectorAll("textarea")).some((t) => t.value.trim() !== "");
}

async function liveCommit(): Promise<string | null> {
  try {
    const h = await healthz();
    return typeof h.commit === "string" && h.commit ? h.commit : null;
  } catch {
    return null;
  }
}

export function StayFresh({
  reload = () => window.location.reload(),
  built = BUILT,
}: {
  reload?: () => void;
  built?: string | null;
}) {
  const opened = useRef<string | null>(built);
  const [updated, setUpdated] = useState(false);

  const check = useCallback(
    async (returning: boolean) => {
      const now = await liveCommit();
      if (!now) return;
      if (opened.current === null) {
        opened.current = now;
        return;
      }
      if (now === opened.current) return;
      if (returning && !isMidTyping() && !reloadedFor(now)) reload();
      else setUpdated(true);
    },
    [reload],
  );

  useEffect(() => {
    // Opening counts as coming back: an old page restored after a deploy
    // should refresh before anyone taps on it.
    const first = window.setTimeout(() => void check(true), 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check(false);
    }, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [check]);

  if (!updated) return null;
  return (
    <div
      role="status"
      className="relative z-30 flex flex-wrap items-center justify-center gap-[var(--pw-spacing-sm)] border-b border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-lg)] pt-[calc(var(--pw-spacing-xs)_+_var(--pw-safe-area-inset-top))] pb-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
    >
      <span>Worlds was updated.</span>
      <button
        type="button"
        onClick={reload}
        className="inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-md)] font-semibold text-[var(--pw-text-primary)] underline underline-offset-2 focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
      >
        Reload
      </button>
    </div>
  );
}
