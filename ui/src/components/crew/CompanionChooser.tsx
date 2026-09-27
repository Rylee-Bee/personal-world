/**
 * Choose your companion, in one tap (owner's first-day walk-through,
 * 2026-09-27: the choice was hidden three levels deep). Faces and names,
 * the Assistant first; pressing one saves it straight away (the same
 * `companion_id` preference Settings → Customize edits) and says so.
 * Opened from the first-day guide's "Meet your crew" and from Your crew.
 */
import { reportSticker } from "../stickers/report";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCrew, usePrefs, usePutPrefs } from "../../data/hooks";
import { describeError } from "../../data/errors";
import { CompanionFace } from "./CompanionFace";
import { ConfirmItsYou } from "../ConfirmItsYou";
import { useConfirmed } from "../useConfirmed";
import { Icon } from "../Icon";

const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, "")}`;
const ASSISTANT_FACE = "/assets/crew/256/assistant-portrait.webp";

export function CompanionChooser({ onChosen }: { onChosen?: (name: string) => void }) {
  const crew = useCrew();
  const prefs = usePrefs();
  const put = usePutPrefs();
  const qc = useQueryClient();
  const confirm = useConfirmed();
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const current = (prefs.data?.data as { companion_id?: string | null } | undefined)?.companion_id ?? null;
  const people = (crew.data?.data ?? []).filter((c) => !c.hidden);
  const options = [
    { id: null as string | null, name: "Assistant", blurb: "The plain voice, with a friendly screen for a face.", portrait: ASSISTANT_FACE },
    ...people.filter((c) => c.id !== "assistant").map((c) => ({ id: c.id as string | null, name: c.name, blurb: c.blurb ?? "", portrait: c.portrait_asset ?? undefined })),
  ];

  function choose(id: string | null, name: string) {
    setSaid(null);
    // PUT /api/prefs is a step-up write; without this the server's 403
    // had no way to be resolved from here (2026-09-27).
    confirm.run((onError) => {
      put.mutate({ companion_id: id }, {
        onSuccess: () => {
          // The Bridge's speaker comes from the briefing; refresh it too.
          void qc.invalidateQueries({ queryKey: ["briefing"] });
          setSaid({ ok: true, words: `${name} is your companion now.` });
          void reportSticker("hello-crew");
          onChosen?.(name);
        },
        onError: (err) => {
          if (!onError(err)) setSaid({ ok: false, words: describeError(err, "Couldn’t save that just now; nothing changed.") });
        },
      });
    });
  }

  if (crew.isPending || prefs.isPending) {
    return <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">Finding your crew…</p>;
  }

  return (
    <div className="flex flex-col gap-[var(--pw-spacing-md)]">
      <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        Who keeps you company in chat and on the Bridge. A companion changes how things are phrased, never what’s true.
      </p>
      <ul className="flex flex-col gap-[var(--pw-spacing-sm)]">
        {options.map((o) => {
          const on = current === o.id || (o.id === null && (current === null || current === "assistant"));
          return (
            <li key={o.id ?? "assistant"}>
              <button
                type="button"
                aria-pressed={on}
                disabled={put.isPending}
                onClick={() => choose(o.id, o.name)}
                className={`flex min-h-[var(--pw-targets-minimum)] w-full items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border p-[var(--pw-spacing-sm)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)] ${
                  on ? "border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)]" : "border-[var(--pw-border-subtle)]"
                }`}
              >
                <CompanionFace name={o.name} portrait={o.portrait ? asset(o.portrait) : undefined} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-[var(--pw-text-primary)]">{o.name}</span>
                  {o.blurb ? <span className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">{o.blurb}</span> : null}
                </span>
                {on ? (
                  <span className="flex shrink-0 items-center gap-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-accent-warm)]">
                    <Icon name="check" size={16} />
                    Chosen
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" className={`min-h-[1.5em] ${said?.ok === false ? "text-[var(--pw-accent-warm)]" : "text-[var(--pw-text-primary)]"}`}>
        {said?.words}
      </p>
      {confirm.confirming && (
        <ConfirmItsYou
          intro="Choosing a companion saves a preference. Confirm it's you first."
          onConfirmed={confirm.confirmed}
          onCancel={confirm.cancel}
        />
      )}
    </div>
  );
}
