/**
 * "Confirm it's you" (the step-up the server asks for before some changes).
 * People who sign in through the provider confirm by signing in there
 * again; people with a sign-in key type it. The session says which ways
 * this person has (GET /api/auth/session → step_up_methods).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useSession, useStepUp } from "../data/hooks";
import { describeError } from "../data/errors";
import { confirmWithSignIn } from "../app/confirmReturn";
import { WorldButton } from "./WorldButton";

const NOTE = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const LABEL = "mb-[var(--pw-spacing-xs)] block text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]";
const CONTROL =
  "w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";

export function ConfirmItsYou({
  onConfirmed,
  onCancel,
  intro = "This change needs you to confirm first. It lasts a few minutes.",
  autoFocus = true,
}: {
  onConfirmed: () => void;
  /** Omit where there is nothing to go back to (no dead "Not now"). */
  onCancel?: () => void;
  intro?: string;
  /** Off where the panel appears on its own (a locked category), so
   *  focus is never pulled on page load. */
  autoFocus?: boolean;
}) {
  const id = useId();
  const session = useSession();
  const methods = session.data?.data?.step_up_methods ?? ["key"];
  const sso = methods.includes("sso");
  const keyAllowed = methods.includes("key") || !sso;
  const [showKey, setShowKey] = useState(!sso);
  const [key, setKey] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const stepUp = useStepUp();
  const firstRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (!autoFocus) return;
    }
    (showKey ? inputRef.current : firstRef.current)?.focus();
  }, [showKey, autoFocus]);

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
      <p
        id={`${id}-title`}
        ref={firstRef as React.RefObject<HTMLParagraphElement>}
        tabIndex={-1}
        className="font-semibold text-[var(--pw-text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--pw-accent-primary)]"
      >
        Confirm it’s you
      </p>
      <p role="note" className={NOTE}>
        {intro}
      </p>

      {sso && (
        <div className="flex flex-col gap-[var(--pw-spacing-xs)]">
          <p className={NOTE}>
            You’ll sign in again with your usual sign-in, then come back to this page. Nothing
            changes until you try your change again.
          </p>
          <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
            {onCancel && (
              <WorldButton type="button" onPress={onCancel}>
                Not now
              </WorldButton>
            )}
            <WorldButton variant="primary" type="button" onPress={confirmWithSignIn}>
              Confirm with your sign-in
            </WorldButton>
          </div>
          {keyAllowed && !showKey && (
            <button
              type="button"
              onClick={() => setShowKey(true)}
              className="self-start min-h-[var(--pw-targets-minimum)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-accent-primary)] underline"
            >
              Use your sign-in key instead
            </button>
          )}
        </div>
      )}

      {showKey && keyAllowed && (
        <>
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
            {!sso && onCancel && (
              <WorldButton type="button" onPress={onCancel}>
                Not now
              </WorldButton>
            )}
            <WorldButton variant="primary" type="submit" isDisabled={stepUp.isPending}>
              {stepUp.isPending ? "Confirming…" : "Confirm"}
            </WorldButton>
          </div>
        </>
      )}
    </form>
  );
}
