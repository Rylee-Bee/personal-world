/**
 * Keep something from anywhere (owner: "I can't stand chasing it down").
 * When Worlds is installed on a phone, it appears in the Share sheet
 * (manifest `share_target`): sharing a link or some text opens Worlds with
 * `?share_text=…&share_url=…&share_title=…`, and this sheet offers
 * Remember (your journal) or Later (the Later shelf), then says "Kept".
 * Nothing is saved until the person taps. Functional; design polishes.
 */
import { useEffect, useRef, useState } from "react";
import { remember } from "../data/api";

function readShared(): string | null {
  try {
    const q = new URL(window.location.href).searchParams;
    const parts = [q.get("share_title"), q.get("share_text"), q.get("share_url")]
      .map((s) => (s ?? "").trim())
      .filter(Boolean);
    return parts.length ? [...new Set(parts)].join("\n").slice(0, 2000) : null;
  } catch {
    return null;
  }
}

function clearShared() {
  try {
    const url = new URL(window.location.href);
    ["share_title", "share_text", "share_url"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
  } catch {
    // Leaving the address as it was is harmless: the sheet only shows once.
  }
}

export function ShareSheet() {
  const [text, setText] = useState<string | null>(() => readShared());
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (text) headingRef.current?.focus();
  }, [text]);
  if (!text && !said) return null;

  const keep = async (later: boolean) => {
    if (!text) return;
    setBusy(true);
    try {
      await remember(text, later, "share");
      setSaid(later ? "Kept on your Later shelf." : "Kept in your journal.");
      setText(null);
      clearShared();
    } catch {
      setSaid("Couldn’t keep it just now; nothing was lost. Try sharing again.");
    } finally {
      setBusy(false);
    }
  };

  const BTN =
    "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_small)] font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)] disabled:opacity-60";
  return (
    <section
      aria-labelledby="share-sheet-heading"
      className="relative z-30 mx-auto my-[var(--pw-spacing-md)] flex max-w-[640px] flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h2 id="share-sheet-heading" ref={headingRef} tabIndex={-1} className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)] focus:outline-none">
        {said ? said : "Keep this?"}
      </h2>
      {text && (
        <>
          <p className="whitespace-pre-wrap break-words text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">{text}</p>
          <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
            <button type="button" disabled={busy} onClick={() => keep(false)} className={`${BTN} bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)]`}>
              Remember
            </button>
            <button type="button" disabled={busy} onClick={() => keep(true)} className={`${BTN} border border-[var(--pw-border-subtle)] text-[var(--pw-text-primary)]`}>
              Later
            </button>
            <button type="button" disabled={busy} onClick={() => { setText(null); clearShared(); }} className={`${BTN} text-[var(--pw-text-muted)]`}>
              Not now
            </button>
          </div>
        </>
      )}
      {said && (
        <span>
          <button type="button" onClick={() => setSaid(null)} className={`${BTN} text-[var(--pw-text-muted)]`}>
            Close
          </button>
        </span>
      )}
    </section>
  );
}
