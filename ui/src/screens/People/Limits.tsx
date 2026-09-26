/**
 * Limits for someone who "has their own space, with limits" (board
 * "People · limits and guests"). A closed set: quiet hours for chat, no
 * sharing outside this World, and a gentle content boundary. Who set them
 * and when is kept, and the person always sees their own (MyLimits).
 */
import { useId, useState } from "react";
import { useSetLimits } from "../../data/hooks";
import type { MyLimits as MyLimitsData } from "../../data/contract";
import { describeError } from "../../data/errors";
import { WorldButton } from "../../components/WorldButton";
import { ConfirmItsYou } from "../../components/ConfirmItsYou";
import { SpotArt } from "../../components/SpotArt";
import { useConfirmed } from "../../components/useConfirmed";
import { dayWords, limitLines } from "./dates";

const NOTE = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const CONTROL =
  "min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";
const CHECK = "mt-1 h-5 w-5 shrink-0 accent-[var(--pw-accent-warm)]";

export function LimitsEditor({ personId, name, onDone }: { personId: string; name: string; onDone: (message: string | null) => void }) {
  const id = useId();
  const setLimits = useSetLimits();
  const confirm = useConfirmed();
  const [quiet, setQuiet] = useState(true);
  const [from, setFrom] = useState("20:00");
  const [to, setTo] = useState("08:00");
  const [noSharing, setNoSharing] = useState(true);
  const [gentle, setGentle] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    setProblem(null);
    const limits = [
      ...(quiet ? [{ key: "chat_quiet_hours", value: `${from}-${to}` }] : []),
      { key: "no_outside_sharing", value: noSharing },
      { key: "content_boundary", value: gentle ? "gentle" : "standard" },
    ];
    confirm.run((onError) =>
      setLimits.mutate(
        { id: personId, limits },
        {
          onSuccess: () => onDone(`Saved ${name}’s limits. ${name} can see them in Settings.`),
          onError: (err) => {
            if (!onError(err)) setProblem(describeError(err, `Couldn’t save ${name}’s limits. Nothing changed.`));
          },
        },
      ),
    );
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      className="mt-[var(--pw-spacing-md)] flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
    >
      <p id={`${id}-title`} className="font-semibold text-[var(--pw-text-primary)]">{`Limits for ${name}`}</p>
      <label className="flex min-h-[var(--pw-targets-minimum)] items-start gap-[var(--pw-spacing-sm)]">
        <input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} className={CHECK} />
        <span className="flex flex-col">
          <span className="font-semibold text-[var(--pw-text-primary)]">Chat rests at night</span>
          <span className={NOTE}>Everything else still works.</span>
        </span>
      </label>
      {quiet && (
        <div className="flex flex-wrap items-center gap-[var(--pw-spacing-sm)] pl-[var(--pw-spacing-xl)]">
          <label htmlFor={`${id}-from`} className={NOTE}>
            From
          </label>
          <input id={`${id}-from`} type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={CONTROL} />
          <label htmlFor={`${id}-to`} className={NOTE}>
            to
          </label>
          <input id={`${id}-to`} type="time" value={to} onChange={(e) => setTo(e.target.value)} className={CONTROL} />
        </div>
      )}
      <label className="flex min-h-[var(--pw-targets-minimum)] items-start gap-[var(--pw-spacing-sm)]">
        <input type="checkbox" checked={noSharing} onChange={(e) => setNoSharing(e.target.checked)} className={CHECK} />
        <span className="flex flex-col">
          <span className="font-semibold text-[var(--pw-text-primary)]">Nothing is shared outside this World</span>
          <span className={NOTE}>No links or finds sent to other apps or people.</span>
        </span>
      </label>
      <label className="flex min-h-[var(--pw-targets-minimum)] items-start gap-[var(--pw-spacing-sm)]">
        <input type="checkbox" checked={gentle} onChange={(e) => setGentle(e.target.checked)} className={CHECK} />
        <span className="flex flex-col">
          <span className="font-semibold text-[var(--pw-text-primary)]">Keep finds and chat gentle</span>
          <span className={NOTE}>Candy and Chat stay with gentler things.</span>
        </span>
      </label>
      <p className={NOTE}>{`${name} sees every limit and that you set it. You manage limits, never ${name}’s journal, notes or chats.`}</p>
      {problem && (
        <p role="alert" className={NOTE}>
          {problem}
        </p>
      )}
      {confirm.confirming ? (
        <ConfirmItsYou onConfirmed={confirm.confirmed} onCancel={confirm.cancel} />
      ) : (
        <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
          <WorldButton type="button" onPress={() => onDone(null)}>
            Not now
          </WorldButton>
          <WorldButton variant="primary" type="button" onPress={save} isDisabled={setLimits.isPending}>
            {setLimits.isPending ? "Saving…" : `Save ${name}’s limits`}
          </WorldButton>
        </div>
      )}
    </div>
  );
}

/** The person's own view: every limit, who set it, and when. */
export function MyLimits({ data, setByName }: { data: MyLimitsData; setByName?: string }) {
  const who = setByName ?? "Someone who helps run this World";
  const lines = limitLines(data.limits);
  return (
    <section
      aria-labelledby="my-limits-heading"
      className="mb-[var(--pw-spacing-2xl)] flex flex-wrap items-start gap-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <SpotArt name="limits" size={56} />
      <div className="min-w-0 flex-1">
        <h2
          id="my-limits-heading"
          className="mb-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]"
          style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
        >
          Your limits
        </h2>
        {lines.length === 0 ? (
          <p className={NOTE}>No limits are set right now.</p>
        ) : (
          <>
            <p className={NOTE}>{`${who} set these to keep things comfortable${data.set_at ? ` (${dayWords(data.set_at)})` : ""}. You can always see them here, and you can ask ${setByName ?? "them"} to change one.`}</p>
            <ul className="mt-[var(--pw-spacing-sm)] list-disc pl-[var(--pw-spacing-lg)] text-[var(--pw-text-primary)]">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </>
        )}
        <p className={`${NOTE} mt-[var(--pw-spacing-sm)]`}>{`Your journal and notes are yours. ${setByName ? `${setByName} can’t read them.` : "Nobody else can read them."}`}</p>
      </div>
    </section>
  );
}
