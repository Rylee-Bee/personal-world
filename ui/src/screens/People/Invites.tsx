/**
 * Invite someone (board "People · household and roles"; roles step 2).
 * A one-time link for a role; the code is shown once, here, and never
 * again. Worlds never sends it for you. Open links can be cancelled.
 */
import { useId, useState, type FormEvent } from "react";
import { useCancelInvite, useCreateInvite, useInvites } from "../../data/hooks";
import type { Invite } from "../../data/contract";
import { describeError } from "../../data/errors";
import { WorldButton } from "../../components/WorldButton";
import { ConfirmItsYou } from "../../components/ConfirmItsYou";
import { SpotArt } from "../../components/SpotArt";
import { useConfirmed } from "../../components/useConfirmed";
import { roleWords } from "./roleWords";
import { dateInDays, dayWords, endOfDayIso, inviteLink } from "./dates";

const SECTION =
  "mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]";
const HEADING = "text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]";
const SERIF = { fontFamily: "var(--pw-typography-font_serif, inherit)" } as const;
const CONTROL =
  "w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";
const LABEL = "mb-[var(--pw-spacing-xs)] block text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]";
const NOTE = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const MICRO = "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]";

function CopyLink({ link, name }: { link: string; name: string }) {
  const id = useId();
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-[var(--pw-spacing-xs)]">
      <label htmlFor={id} className={LABEL}>
        {`${name}’s link`}
      </label>
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <input
          id={id}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className={`${CONTROL} min-w-0 flex-1 font-mono text-[length:var(--pw-typography-size_small)]`}
        />
        <WorldButton
          variant="primary"
          onPress={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied("Copied.");
            } catch {
              (document.getElementById(id) as HTMLInputElement | null)?.select();
              setCopied("Selected: copy it with your keyboard.");
            }
          }}
        >
          Copy link
        </WorldButton>
      </div>
      <p role="status" className={MICRO}>
        {copied ?? ""}
      </p>
    </div>
  );
}

export function InviteSection({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const id = useId();
  const invites = useInvites(true);
  const create = useCreateInvite();
  const cancel = useCancelInvite();
  const confirm = useConfirmed();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [until, setUntil] = useState(dateInDays(3));
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string; link: string; expires: string } | null>(null);

  const roles = ["member", "supervised", "guest", ...(canInviteAdmin ? ["admin"] : [])];
  const openInvites = (invites.data?.data ?? []).filter((i: Invite) => !i.used_at && !i.expired);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (name.trim() === "") {
      setProblem("Add their name, so you know which link is whose.");
      return;
    }
    const body = {
      role,
      display_name: name.trim(),
      ...(role === "guest" ? { guest_until: endOfDayIso(until) } : {}),
    };
    confirm.run((onError) =>
      create.mutate(body, {
        onSuccess: (res) => {
          const data = res.data;
          if (!data) {
            setProblem("The link didn’t come back. Try again.");
            return;
          }
          setMade({ name: data.display_name, link: data.link ?? inviteLink(data.token), expires: dayWords(data.expires_at) });
          setName("");
          setOpen(false);
        },
        onError: (err) => {
          if (!onError(err)) setProblem(describeError(err, "Couldn’t make the link. Nothing changed."));
        },
      }),
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} className={SECTION}>
      <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
        <SpotArt name="guest" size={56} />
        <h2 id={`${id}-title`} className={`${HEADING} flex-1`} style={SERIF}>
          Invite someone
        </h2>
        {!open && (
          <WorldButton variant="primary" onPress={() => setOpen(true)}>
            Invite someone
          </WorldButton>
        )}
      </div>

      {made && (
        <div className="mt-[var(--pw-spacing-md)] flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]">
          <p role="status" className="font-semibold text-[var(--pw-text-primary)]">
            {`Here’s ${made.name}’s link.`}
          </p>
          <p className={NOTE}>
            {`Give it to them however you like. It works once and stops working ${made.expires ? `on ${made.expires}` : "in 3 days"}. This is the only time Worlds shows it, and Worlds never sends it for you.`}
          </p>
          <CopyLink link={made.link} name={made.name} />
          <WorldButton onPress={() => setMade(null)}>Done</WorldButton>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="mt-[var(--pw-spacing-md)] flex flex-col gap-[var(--pw-spacing-md)]">
          <div>
            <label htmlFor={`${id}-name`} className={LABEL}>
              Their name
            </label>
            <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} className={CONTROL} autoComplete="off" />
          </div>
          <fieldset className="flex flex-col gap-[var(--pw-spacing-xs)] border-0 p-0">
            <legend className={LABEL}>What they can do</legend>
            {roles.map((r) => (
              <label key={r} className="flex min-h-[var(--pw-targets-minimum)] cursor-pointer items-center gap-[var(--pw-spacing-sm)]">
                <input
                  type="radio"
                  name={`${id}-role`}
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="h-5 w-5 shrink-0 accent-[var(--pw-accent-warm)]"
                />
                <span className="text-[var(--pw-text-primary)]">{roleWords(r).label}</span>
              </label>
            ))}
          </fieldset>
          {role === "guest" && (
            <div>
              <label htmlFor={`${id}-until`} className={LABEL}>
                Visiting until
              </label>
              <input
                id={`${id}-until`}
                type="date"
                value={until}
                min={dateInDays(1)}
                max={dateInDays(30)}
                onChange={(e) => setUntil(e.target.value)}
                aria-describedby={`${id}-until-hint`}
                className={CONTROL}
              />
              <p id={`${id}-until-hint`} className={MICRO}>
                Their access ends that evening on its own. You can end it sooner.
              </p>
            </div>
          )}
          <p className={NOTE}>
            You’ll get a one-time link to give them. It stops working after 3 days or once it’s used.
            Worlds never sends it for you.
          </p>
          {problem && (
            <p role="alert" className={NOTE}>
              {problem}
            </p>
          )}
          {!confirm.confirming && (
            <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
              <WorldButton type="button" onPress={() => setOpen(false)}>
                Not now
              </WorldButton>
              <WorldButton variant="primary" type="submit" isDisabled={create.isPending}>
                {create.isPending ? "Making the link…" : "Make the link"}
              </WorldButton>
            </div>
          )}
        </form>
      )}
      {/* Its own form, so never inside the one above. */}
      {confirm.confirming && <ConfirmItsYou onConfirmed={confirm.confirmed} onCancel={confirm.cancel} />}

      {openInvites.length > 0 && (
        <div className="mt-[var(--pw-spacing-lg)]">
          <h3 className="mb-[var(--pw-spacing-xs)] font-semibold text-[var(--pw-text-primary)]">
            {`Links not used yet · ${openInvites.length}`}
          </h3>
          <ul>
            {openInvites.map((inv) => (
              <li key={inv.invite_id} className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--pw-text-primary)]">{inv.display_name}</p>
                  <p className={MICRO}>
                    {`${roleWords(inv.role).label} · link works until ${dayWords(inv.expires_at) || "it expires"}`}
                  </p>
                </div>
                <WorldButton
                  aria-label={`Cancel ${inv.display_name}’s link`}
                  isDisabled={cancel.isPending}
                  onPress={() =>
                    confirm.run((onError) =>
                      cancel.mutate(inv.invite_id, {
                        onError: (err) => {
                          if (!onError(err)) setProblem(describeError(err, "Couldn’t cancel that link. It still works."));
                        },
                      }),
                    )
                  }
                >
                  Cancel link
                </WorldButton>
              </li>
            ))}
          </ul>
          {!open && problem && (
            <p role="alert" className={NOTE}>
              {problem}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
