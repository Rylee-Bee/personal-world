/**
 * People (board "People · household and roles", owner said build
 * 2026-09-26). Who's here, each role said as what the person can do,
 * changing a role, and handing the World over. Admins manage accounts,
 * never content: nothing here reads anyone's journal, notes or chats.
 *
 *   GET  /api/me                          what I may do
 *   GET  /api/people                      everyone (manage_people)
 *   PUT  /api/people/{id}/role            change a role (step-up)
 *   POST /api/people/transfer-ownership   hand over (owner, step-up)
 *
 * Writes that need a fresh "Confirm it's you" show the confirm form in
 * place and retry once it succeeds. Invites, helpers, limits and guest
 * end dates arrive with roles step 2; nothing for them is shown yet.
 */
import { Icon } from "../../components/Icon";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMe, usePeople, useSetRole, useStepUp, useTransferOwnership } from "../../data/hooks";
import type { Person } from "../../data/contract";
import { describeError, needsConfirm } from "../../data/errors";
import { WorldButton } from "../../components/WorldButton";
import { ASSIGNABLE_ROLES, ROLE_CHOICE_HINT, roleWords } from "./roleWords";

const SECTION =
  "mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]";
const HEADING = "text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]";
const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const CONTROL =
  "w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";
const LABEL = "mb-[var(--pw-spacing-xs)] block text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]";
const NOTE = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const MICRO = "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]";

function nameOf(p: { display_name: string | null; id: string }): string {
  return p.display_name?.trim() || "Someone";
}

function Initial({ name, agent = false }: { name: string; agent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--pw-surface-hull)] text-[length:var(--pw-typography-size_lead)] text-[var(--pw-text-primary)] ${
        agent ? "border-[var(--pw-accent-primary)]" : "border-[var(--pw-border-subtle)]"
      }`}
      style={SERIF}
    >
      {agent ? <Icon name="agent" size={24} /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** "Confirm it's you": re-enter the sign-in key to mint the short grant
 *  the server asks for, then run the held write again. */
function ConfirmItsYou({ onConfirmed, onCancel }: { onConfirmed: () => void; onCancel: () => void }) {
  const id = useId();
  const [key, setKey] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const stepUp = useStepUp();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (key.trim() === "") {
      setProblem("Enter your sign-in key to confirm.");
      return;
    }
    stepUp.mutate(key.trim(), {
      onSuccess: () => {
        setKey("");
        onConfirmed();
      },
      onError: (err) =>
        setProblem(
          err instanceof Error && /invalid|403/i.test(err.message)
            ? "That key didn't match. Nothing changed."
            : describeError(err, "Couldn't confirm. Nothing changed."),
        ),
    });
  };

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className="mt-[var(--pw-spacing-md)] flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
    >
      <p id={`${id}-title`} className="font-semibold text-[var(--pw-text-primary)]">
        Confirm it’s you
      </p>
      <p className={NOTE}>This change needs you to confirm first. It lasts a few minutes.</p>
      <label htmlFor={`${id}-key`} className={LABEL}>
        Your sign-in key
      </label>
      <input
        ref={inputRef}
        id={`${id}-key`}
        type="password"
        autoComplete="current-password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        aria-describedby={problem ? `${id}-problem` : undefined}
        className={CONTROL}
      />
      {problem && (
        <p id={`${id}-problem`} role="alert" className={NOTE}>
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <WorldButton type="button" onPress={onCancel}>
          Not now
        </WorldButton>
        <WorldButton variant="primary" type="submit" isDisabled={stepUp.isPending}>
          {stepUp.isPending ? "Confirming…" : "Confirm"}
        </WorldButton>
      </div>
    </form>
  );
}

function ChangeRole({ person, onDone }: { person: Person; onDone: (message: string | null) => void }) {
  const id = useId();
  const name = nameOf(person);
  const current = (ASSIGNABLE_ROLES as readonly string[]).includes(person.role ?? "") ? person.role! : "member";
  const [choice, setChoice] = useState<string>(current);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const setRole = useSetRole();
  const titleRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => titleRef.current?.focus(), []);

  const save = () => {
    setProblem(null);
    setRole.mutate(
      { id: person.id, role: choice },
      {
        onSuccess: () => onDone(`Saved. ${name}: ${roleWords(choice).label}.`),
        onError: (err) => {
          if (needsConfirm(err)) setConfirming(true);
          else setProblem(describeError(err, `Couldn’t change what ${name} can do. Nothing changed.`));
        },
      },
    );
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      className="mt-[var(--pw-spacing-md)] flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
    >
      <p
        id={`${id}-title`}
        ref={titleRef}
        tabIndex={-1}
        className="font-semibold text-[var(--pw-text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--pw-accent-primary)]"
        style={SERIF}
      >
        {`Change what ${name} can do`}
      </p>
      <fieldset className="flex flex-col gap-[var(--pw-spacing-xs)] border-0 p-0">
        <legend className="sr-only">{`What ${name} can do`}</legend>
        {ASSIGNABLE_ROLES.map((role) => (
          <label key={role} className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-start gap-[var(--pw-spacing-sm)] py-[var(--pw-spacing-xs)]">
            <input
              type="radio"
              name={`${id}-role`}
              value={role}
              checked={choice === role}
              onChange={() => setChoice(role)}
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--pw-accent-warm)]"
            />
            <span className="flex flex-col">
              <span className="font-semibold text-[var(--pw-text-primary)]">{roleWords(role).label}</span>
              <span className={NOTE}>{ROLE_CHOICE_HINT[role]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {problem && (
        <p role="alert" className={NOTE}>
          {problem}
        </p>
      )}
      {confirming ? (
        <ConfirmItsYou
          onConfirmed={() => {
            setConfirming(false);
            save();
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
          <WorldButton type="button" onPress={() => onDone(null)}>
            Not now
          </WorldButton>
          <WorldButton
            variant="primary"
            type="button"
            onPress={save}
            isDisabled={setRole.isPending || choice === person.role}
          >
            {setRole.isPending ? "Saving…" : `Save for ${name}`}
          </WorldButton>
        </div>
      )}
    </div>
  );
}

function PersonRow({
  person,
  isMe,
  canChange,
  onChanged,
}: {
  person: Person;
  isMe: boolean;
  canChange: boolean;
  onChanged: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const changeId = `change-${person.id}`;
  const returnFocus = useRef(false);
  // After the form closes, focus goes back to this row's Change button
  // once it is rendered again.
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      document.getElementById(changeId)?.focus();
    }
  }, [open, changeId]);
  const name = nameOf(person);
  const words = roleWords(person.role);
  return (
    <li className="border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-md)]">
      <div className="flex items-center gap-[var(--pw-spacing-md)]">
        <Initial name={name} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--pw-text-primary)]">
            {name}
            {isMe && <span className={`${NOTE} font-normal`}> (you)</span>}
          </p>
          <p className="text-[var(--pw-text-secondary)]">{words.label}</p>
          <p className={MICRO}>{words.detail}</p>
        </div>
        {canChange && !open && (
          <WorldButton id={changeId} onPress={() => setOpen(true)} aria-label={`Change what ${name} can do`}>
            Change
          </WorldButton>
        )}
      </div>
      {open && (
        <ChangeRole
          person={person}
          onDone={(message) => {
            returnFocus.current = true;
            setOpen(false);
            if (message) onChanged(message);
          }}
        />
      )}
    </li>
  );
}

function HandOver({ admins, onDone }: { admins: Person[]; onDone: (message: string) => void }) {
  const id = useId();
  const [to, setTo] = useState<string>(admins[0]?.id ?? "");
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const transfer = useTransferOwnership();
  const target = admins.find((a) => a.id === to) ?? null;
  const targetName = target ? nameOf(target) : "";
  const matches = target !== null && typed.trim() === targetName;

  const send = () => {
    if (!target) return;
    setProblem(null);
    transfer.mutate(target.id, {
      onSuccess: () => onDone(`${targetName} now runs this World. You help run it, and your own space stays yours.`),
      onError: (err) => {
        if (needsConfirm(err)) setConfirming(true);
        else setProblem(describeError(err, "Couldn’t hand this World over. Nothing changed."));
      },
    });
  };

  return (
    <section aria-labelledby={`${id}-title`} className={`${SECTION} border-[var(--pw-accent-coral)]`}>
      <h2 id={`${id}-title`} className={HEADING} style={SERIF}>
        Hand this World over
      </h2>
      {admins.length === 0 ? (
        <p className={`${NOTE} mt-[var(--pw-spacing-sm)]`}>
          Only someone who helps run this World can take it over. Change what someone can do to
          “Helps run this World” first.
        </p>
      ) : (
        <div className="mt-[var(--pw-spacing-sm)] flex flex-col gap-[var(--pw-spacing-md)]">
          <ul className={`${NOTE} list-disc pl-[var(--pw-spacing-lg)]`}>
            <li>They will run this World and can hand it on again.</li>
            <li>You’ll stay, helping run it. Your own space stays yours.</li>
            <li>Only one person runs a World at a time.</li>
          </ul>
          {admins.length > 1 && (
            <div>
              <label htmlFor={`${id}-to`} className={LABEL}>
                Hand it to
              </label>
              <select id={`${id}-to`} value={to} onChange={(e) => setTo(e.target.value)} className={CONTROL}>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {nameOf(a)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor={`${id}-typed`} className={LABEL}>
              {`Type ${targetName}’s name to confirm`}
            </label>
            <input
              id={`${id}-typed`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              aria-describedby={`${id}-typed-hint`}
              className={CONTROL}
            />
            <p id={`${id}-typed-hint`} className={MICRO}>
              It has to match exactly, so this can’t happen by accident.
            </p>
          </div>
          {problem && (
            <p role="alert" className={NOTE}>
              {problem}
            </p>
          )}
          {confirming ? (
            <ConfirmItsYou
              onConfirmed={() => {
                setConfirming(false);
                send();
              }}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
              <WorldButton type="button" onPress={() => setTyped("")}>
                Keep it with me
              </WorldButton>
              <WorldButton
                type="button"
                onPress={send}
                isDisabled={!matches || transfer.isPending}
              >
                {transfer.isPending ? "Handing over…" : `Hand over to ${targetName}`}
              </WorldButton>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function People({ onBack }: { onBack: () => void }) {
  const me = useMe();
  const perms = me.data?.data?.permissions ?? [];
  const canManage = perms.includes("manage_people");
  const canHandOver = perms.includes("transfer_ownership");
  const people = usePeople(canManage);
  const [message, setMessage] = useState<string | null>(null);

  const all = people.data?.data ?? [];
  const persons = all.filter((p) => p.kind === "person");
  const agents = all.filter((p) => p.kind === "agent");
  const myId = me.data?.data?.id;
  const admins = persons.filter((p) => p.role === "admin" && p.id !== myId);
  const alone = persons.length <= 1;

  return (
    <main
      id="main-content"
      aria-label="People"
      className="relative z-10 max-w-[1100px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]"
    >
      <header className="mb-[var(--pw-spacing-2xl)] flex flex-col gap-[var(--pw-spacing-sm)]">
        <WorldButton variant="ghost" onPress={onBack} className="self-start">
          <Icon name="back" size={16} className="mr-[var(--pw-spacing-xs)]" />
          Back to Settings
        </WorldButton>
        <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]" style={SERIF}>
          People in this World
        </h1>
        <p className={`${NOTE} max-w-[60ch]`}>
          Who’s here and what each person can do. You manage accounts here, never anyone’s journal,
          notes or chats.
        </p>
      </header>

      <p role="status" className={`${NOTE} mb-[var(--pw-spacing-md)] min-h-[1.5em]`}>
        {message ?? ""}
      </p>

      {me.isPending || (canManage && people.isPending) ? (
        <p role="status" className={NOTE}>
          Finding who’s here…
        </p>
      ) : !canManage ? (
        <section className={SECTION}>
          <p className={NOTE}>
            Only people who run or help run this World can see everyone here. Your own space is in
            Memory, Chat and Settings.
          </p>
        </section>
      ) : people.isError ? (
        <section className={SECTION}>
          <p role="alert" className={NOTE}>
            Couldn’t load the people here right now. Nothing has changed.
          </p>
          <WorldButton onPress={() => void people.refetch()}>Try again</WorldButton>
        </section>
      ) : (
        <>
          <section aria-labelledby="people-list-heading" className={SECTION}>
            <h2 id="people-list-heading" className={HEADING} style={SERIF}>
              {`People · ${persons.length}`}
            </h2>
            {alone ? (
              <p className={`${NOTE} mt-[var(--pw-spacing-sm)]`}>
                It’s just you here, and that’s fine. Everything works for one person.
              </p>
            ) : null}
            <ul className="mt-[var(--pw-spacing-sm)]">
              {persons.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  isMe={p.id === myId}
                  canChange={p.id !== myId && p.role !== "owner"}
                  onChanged={setMessage}
                />
              ))}
            </ul>
            {agents.length > 0 && (
              <details className="mt-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] pt-[var(--pw-spacing-sm)]">
                <summary className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center font-semibold text-[var(--pw-text-primary)]">
                  {`Programs that act here · ${agents.length}`}
                </summary>
                <p className={NOTE}>
                  Agents and services, listed apart so they’re never mistaken for people. Deploys,
                  secrets, deletes and spending always ask first.
                </p>
                <ul>
                  {agents.map((a) => (
                    <li key={a.id} className="flex items-center gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-md)]">
                      <Initial name={nameOf(a)} agent />
                      <p className="font-semibold text-[var(--pw-text-primary)]">{nameOf(a)}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          {canHandOver && !alone && <HandOver admins={admins} onDone={setMessage} />}
        </>
      )}
    </main>
  );
}
