/**
 * Let someone help me (board "People · let someone help me"; roles step 2).
 * A person lets someone they trust see what needs them, or act for them,
 * for a while. They see every action in plain words, and one tap ends it.
 * Journals, notes, chats and secrets are never part of helping.
 */
import { useId, useState, type FormEvent } from "react";
import { useGrantHelper, useHelpedBy, useMe, useMyHelpers, usePeople, useRevokeHelper } from "../../data/hooks";
import type { HelperGrant } from "../../data/contract";
import { describeError } from "../../data/errors";
import { WorldButton } from "../../components/WorldButton";
import { ConfirmItsYou } from "../../components/ConfirmItsYou";
import { SpotArt } from "../../components/SpotArt";
import { Icon } from "../../components/Icon";
import { useConfirmed } from "../../components/useConfirmed";
import { dayWords } from "../People/dates";

const SECTION =
  "mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]";
const HEADING = "text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]";
const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const CONTROL =
  "w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";
const LABEL = "mb-[var(--pw-spacing-xs)] block text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]";
const NOTE = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const MICRO = "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]";
const RADIO = "h-5 w-5 shrink-0 accent-[var(--pw-accent-warm)]";

const LENGTHS = [
  { id: "1", days: 1, label: "Today" },
  { id: "7", days: 7, label: "7 days" },
  { id: "30", days: 30, label: "30 days" },
] as const;

export function Helpers({ onBack }: { onBack: () => void }) {
  const id = useId();
  const me = useMe();
  const canList = me.data?.data?.permissions.includes("manage_people") ?? false;
  const people = usePeople(canList);
  const grants = useMyHelpers();
  const log = useHelpedBy();
  const grant = useGrantHelper();
  const revoke = useRevokeHelper();
  const confirm = useConfirmed();
  const [who, setWho] = useState("");
  const [canAct, setCanAct] = useState(false);
  const [length, setLength] = useState<string>("7");
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const myId = me.data?.data?.id;
  const choices = (people.data?.data ?? []).filter((p) => p.kind === "person" && p.id !== myId && !p.expired);
  const nameFor = (pid: string) =>
    (people.data?.data ?? []).find((p) => p.id === pid)?.display_name?.trim() || pid.replace(/^person:/, "");
  const live = (grants.data?.data ?? []).filter((g: HelperGrant) => g.live);
  const helping = me.data?.data?.helping ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (!who) {
      setProblem("Choose who can help.");
      return;
    }
    const days = LENGTHS.find((l) => l.id === length)?.days ?? 7;
    const until = new Date(Date.now() + days * 86_400_000 - 60_000).toISOString();
    const helperName = nameFor(who);
    confirm.run((onError) =>
      grant.mutate(
        { helper_id: who, can_act: canAct, until },
        {
          onSuccess: () => {
            setMessage(`${helperName} can ${canAct ? "act for you" : "see what needs you"} until ${dayWords(until)}.`);
            setWho("");
          },
          onError: (err) => {
            if (!onError(err)) setProblem(describeError(err, `Couldn’t let ${helperName} help. Nothing changed.`));
          },
        },
      ),
    );
  };

  const stop = (g: HelperGrant) => {
    const helperName = nameFor(g.helper_id);
    confirm.run((onError) =>
      revoke.mutate(g.grant_id, {
        onSuccess: () => setMessage(`${helperName} can’t help any more. They’ll get a plain note that it ended.`),
        onError: (err) => {
          if (!onError(err)) setProblem(describeError(err, `Couldn’t stop ${helperName}’s help. It’s still on.`));
        },
      }),
    );
  };

  return (
    <main id="main-content" aria-label="Let someone help me" className="relative z-10 max-w-[1100px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]">
      <header className="mb-[var(--pw-spacing-2xl)] flex flex-col gap-[var(--pw-spacing-sm)]">
        <WorldButton variant="ghost" onPress={onBack} className="self-start">
          <Icon name="back" size={16} className="mr-[var(--pw-spacing-xs)]" />
          Back to Settings
        </WorldButton>
        <div className="flex items-center gap-[var(--pw-spacing-md)]">
          <SpotArt name="helper" size={64} />
          <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
            Let someone help you
          </h1>
        </div>
        <p className={`${NOTE} max-w-[60ch]`}>
          For bad days: someone you trust can keep an eye on what needs you, or act for you. You see
          everything they do, and you can stop it any time. They never see your journal, notes, chats
          or secrets.
        </p>
      </header>

      <p role="status" className={`${NOTE} mb-[var(--pw-spacing-md)] min-h-[1.5em]`}>
        {message ?? ""}
      </p>

      <section aria-labelledby={`${id}-grant`} className={SECTION}>
        <h2 id={`${id}-grant`} className={HEADING} style={SERIF}>
          Choose a helper
        </h2>
        {canList && choices.length === 0 && !people.isPending ? (
          <p className={`${NOTE} mt-[var(--pw-spacing-sm)]`}>There’s nobody else here yet. Invite someone from People first.</p>
        ) : !canList ? (
          <p className={`${NOTE} mt-[var(--pw-spacing-sm)]`}>
            Choosing a helper from a list of people is coming next. Until then, ask the person who runs
            this World.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-[var(--pw-spacing-md)] flex flex-col gap-[var(--pw-spacing-md)]">
            <div>
              <label htmlFor={`${id}-who`} className={LABEL}>
                Who
              </label>
              <select id={`${id}-who`} value={who} onChange={(e) => setWho(e.target.value)} className={CONTROL}>
                <option value="">Choose someone</option>
                {choices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name?.trim() || p.id}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="flex flex-col gap-[var(--pw-spacing-xs)] border-0 p-0">
              <legend className={LABEL}>What they can do</legend>
              <label className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-start gap-[var(--pw-spacing-sm)]">
                <input type="radio" name={`${id}-act`} checked={!canAct} onChange={() => setCanAct(false)} className={`${RADIO} mt-1`} />
                <span className="flex flex-col">
                  <span className="font-semibold text-[var(--pw-text-primary)]">See what needs me</span>
                  <span className={NOTE}>Your Needs you list and room updates.</span>
                </span>
              </label>
              <label className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-start gap-[var(--pw-spacing-sm)]">
                <input type="radio" name={`${id}-act`} checked={canAct} onChange={() => setCanAct(true)} className={`${RADIO} mt-1`} />
                <span className="flex flex-col">
                  <span className="font-semibold text-[var(--pw-text-primary)]">Act for me</span>
                  <span className={NOTE}>They can also mark things seen and approve or decline for you.</span>
                </span>
              </label>
            </fieldset>
            <fieldset className="flex flex-col gap-[var(--pw-spacing-xs)] border-0 p-0">
              <legend className={LABEL}>For how long</legend>
              <div className="flex flex-wrap gap-[var(--pw-spacing-lg)]">
                {LENGTHS.map((l) => (
                  <label key={l.id} className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center gap-[var(--pw-spacing-sm)]">
                    <input type="radio" name={`${id}-len`} checked={length === l.id} onChange={() => setLength(l.id)} className={RADIO} />
                    <span className="text-[var(--pw-text-primary)]">{l.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {problem && (
              <p role="alert" className={NOTE}>
                {problem}
              </p>
            )}
            {!confirm.confirming && (
              <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
                <WorldButton variant="primary" type="submit" isDisabled={grant.isPending}>
                  {grant.isPending ? "Saving…" : who ? `Let ${nameFor(who)} help` : "Let them help"}
                </WorldButton>
              </div>
            )}
          </form>
        )}
        {/* Its own form, so never inside the one above. */}
        {confirm.confirming && <ConfirmItsYou onConfirmed={confirm.confirmed} onCancel={confirm.cancel} />}
      </section>

      <section aria-labelledby={`${id}-now`} className={SECTION}>
        <h2 id={`${id}-now`} className={HEADING} style={SERIF}>
          {`Helping you now · ${live.length}`}
        </h2>
        {live.length === 0 ? (
          <p className={`${NOTE} mt-[var(--pw-spacing-sm)]`}>Nobody is helping you right now.</p>
        ) : (
          <ul className="mt-[var(--pw-spacing-sm)]">
            {live.map((g) => (
              <li key={g.grant_id} className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-md)]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--pw-text-primary)]">{nameFor(g.helper_id)}</p>
                  <p className={NOTE}>{`${g.can_act ? "Can act for you" : "Can see what needs you"} · until ${dayWords(g.until)}`}</p>
                </div>
                <WorldButton aria-label={`Stop ${nameFor(g.helper_id)}’s help now`} onPress={() => stop(g)} isDisabled={revoke.isPending}>
                  Stop now
                </WorldButton>
              </li>
            ))}
          </ul>
        )}
        <p className={`${MICRO} mt-[var(--pw-spacing-sm)]`}>Stopping takes effect at once.</p>
      </section>

      <section aria-labelledby={`${id}-log`} className={SECTION}>
        <h2 id={`${id}-log`} className={HEADING} style={SERIF}>
          Who helped me
        </h2>
        <p className={`${NOTE} mt-[var(--pw-spacing-xs)]`}>Everything a helper did for you, in plain words.</p>
        {(log.data?.data ?? []).length === 0 ? (
          <p className={`${NOTE} mt-[var(--pw-spacing-sm)]`}>Nobody has done anything for you yet.</p>
        ) : (
          <ul className="mt-[var(--pw-spacing-sm)]">
            {(log.data?.data ?? []).map((row, i) => (
              <li key={`${row.at}-${i}`} className="grid grid-cols-[minmax(0,1fr)] gap-[var(--pw-spacing-xs)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)] min-[640px]:grid-cols-[160px_minmax(0,1fr)]">
                <span className={MICRO}>{new Date(row.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                <span className="text-[var(--pw-text-primary)]">{row.summary || `${nameFor(row.helper_id)}: ${row.action}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {helping.length > 0 && (
        <section aria-labelledby={`${id}-helping`} className={SECTION}>
          <h2 id={`${id}-helping`} className={HEADING} style={SERIF}>
            People you can help
          </h2>
          <ul className="mt-[var(--pw-spacing-sm)]">
            {helping.map((h) => (
              <li key={h.person_id} className="border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)] text-[var(--pw-text-primary)]">
                {`${nameFor(h.person_id)} · ${h.can_act ? "you can act for them" : "you can see what needs them"} · until ${dayWords(h.until)}`}
              </li>
            ))}
          </ul>
          <p className={`${MICRO} mt-[var(--pw-spacing-sm)]`}>Helping from their Bridge comes next.</p>
        </section>
      )}
    </main>
  );
}
