/**
 * "Your lore": rylee_lore in Worlds. "Check for changes" asks the Engine
 * room what a sync would do (a dry run: nothing changes); "Bring it in"
 * imports, everything as *suggested*. "Confirm the accepted ones" promotes
 * what the lore itself marks accepted, behind "Confirm it's you"; only
 * the owner confirms. What stays out (medical notes, encrypted notes) is
 * named with its count, never silently hidden. Functional first; design
 * polishes.
 */
import { useState } from "react";
import { useLore, useLoreConfirm, useLoreSync } from "../../data/hooks";
import type { LoreSyncReport } from "../../data/api";
import { ConfirmItsYou } from "../../components/ConfirmItsYou";
import { useConfirmed } from "../../components/useConfirmed";
import { describeError } from "../../data/errors";

const NOTE = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const BUTTON =
  "inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)] disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";
const PRIMARY = `${BUTTON} border-transparent bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)]`;

const SKIPPED_WORDS: Record<string, string> = {
  "pain-research": "medical notes",
  "medical-looking": "sections that look medical",
  "context/vault": "encrypted notes",
  inbox: "inbox items",
  "context/chatgpt-notes": "chat notes",
  "context/archive": "archived notes",
  "context/retired": "retired notes",
};

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function preview(r: LoreSyncReport): string {
  const c = r.counts;
  const parts = [
    c.new && `${plural(c.new, "new item")}`,
    c.changed && `${plural(c.changed, "changed item")}`,
    c.gone && `${plural(c.gone, "item")} no longer in your lore`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") + "." : "Nothing new; Worlds already has all of it.";
}

export function LoreSection() {
  const lore = useLore();
  const sync = useLoreSync();
  const confirmLore = useLoreConfirm();
  const confirm = useConfirmed();
  const [report, setReport] = useState<LoreSyncReport | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const data = lore.data?.data;
  const counts = data?.counts ?? {};

  const check = () => {
    setSaid(null);
    sync.mutate(true, { onSuccess: (r) => setReport(r.data ?? null), onError: (e) => setSaid(describeError(e, "Couldn’t check your lore.")) });
  };
  const bringIn = () =>
    sync.mutate(false, {
      onSuccess: (r) => {
        setReport(null);
        setSaid(`Brought in: ${preview(r.data!)} Everything new waits as a suggestion until you confirm it.`);
      },
      onError: (e) => setSaid(describeError(e, "Couldn’t bring your lore in; nothing changed.")),
    });
  const confirmAccepted = () =>
    confirm.run((onError) =>
      confirmLore.mutate(
        { accepted: true },
        {
          onSuccess: (r) => setSaid(`Confirmed ${plural(r.data?.confirmed ?? 0, "item")}.`),
          onError: (e) => {
            if (!onError(e)) setSaid(describeError(e, "Couldn’t confirm; nothing changed."));
          },
        },
      ),
    );

  const skipped = Object.entries(report?.skipped ?? {}).filter(([, n]) => n > 0);

  return (
    <div className="flex flex-col gap-[var(--pw-spacing-md)]">
      <p className={NOTE}>
        Your lore (rylee_lore) comes in through the Engine room. New things arrive as suggestions; only you confirm them.
      </p>
      <p className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]" aria-live="polite">
        {lore.isLoading
          ? "Reading your lore…"
          : `${counts.confirmed ?? 0} confirmed · ${counts.suggested ?? 0} waiting for you`}
      </p>
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <button type="button" className={BUTTON} onClick={check} disabled={sync.isPending}>
          {sync.isPending && sync.variables === true ? "Checking…" : "Check for changes"}
        </button>
        {(data?.accepted_waiting ?? 0) > 0 && (
          <button type="button" className={PRIMARY} onClick={confirmAccepted} disabled={confirmLore.isPending}>
            {`Confirm the ${plural(data!.accepted_waiting, "accepted one")}`}
          </button>
        )}
      </div>
      {report && (
        <div role="status" className="flex flex-col gap-[var(--pw-spacing-sm)]">
          <p className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">{preview(report)}</p>
          {skipped.length > 0 && (
            <p className={NOTE}>
              {"Kept out on purpose: " +
                skipped.map(([k, n]) => `${n} ${SKIPPED_WORDS[k] ?? k}`).join(", ") +
                ". They stay where they are."}
            </p>
          )}
          {report.counts.new + report.counts.changed + report.counts.gone > 0 && (
            <span>
              <button type="button" className={PRIMARY} onClick={bringIn} disabled={sync.isPending}>
                {sync.isPending && sync.variables === false ? "Bringing it in…" : "Bring it in"}
              </button>
            </span>
          )}
        </div>
      )}
      {said && (
        <p role="status" className={NOTE}>
          {said}
        </p>
      )}
      {confirm.confirming && (
        <ConfirmItsYou
          intro="Confirming lore makes it what Worlds treats as true about you. Confirm it's you first."
          onConfirmed={confirm.confirmed}
          onCancel={confirm.cancel}
        />
      )}
    </div>
  );
}
