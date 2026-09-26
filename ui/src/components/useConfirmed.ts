/**
 * Run a write that may need "Confirm it's you": if the server answers with
 * the step-up gate, show <ConfirmItsYou> and run the same write again once
 * the person has confirmed. The caller renders `confirming` as the prompt.
 */
import { useRef, useState } from "react";
import { needsConfirm } from "../data/errors";

export function useConfirmed() {
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  /** `attempt` runs the write; call `onError(err)` from it on failure. */
  function run(attempt: (onError: (err: unknown) => boolean) => void) {
    const go = () =>
      attempt((err) => {
        if (needsConfirm(err)) {
          pending.current = go;
          setConfirming(true);
          return true;
        }
        return false;
      });
    go();
  }

  return {
    confirming,
    run,
    confirmed: () => {
      setConfirming(false);
      const next = pending.current;
      pending.current = null;
      next?.();
    },
    cancel: () => {
      pending.current = null;
      setConfirming(false);
    },
  };
}
