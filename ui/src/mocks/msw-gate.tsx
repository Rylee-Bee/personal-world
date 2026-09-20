/**
 * MswGate — blocks a story's render until its MSW handlers are active.
 *
 * Lives in its own module so .storybook/preview.tsx stays config-only
 * (React Fast Refresh rule) and the gate logic is unit-testable.
 */

import { useEffect, useState, type ReactNode } from "react";
import { worker } from "./browser";
import { createHandlers, type HandlerSet } from "./handlers";

let workerStart: Promise<unknown> | undefined;
function startWorkerOnce(): Promise<unknown> {
  workerStart ??= worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
  });
  return workerStart;
}

/**
 * `setsKey` is a "|"-joined list of handler-set names. Readiness is
 * derived from comparing the last-installed key with the current one —
 * when a story swaps, the subtree unmounts immediately (no stale
 * handlers answering its first fetch) and remounts once the new sets
 * are registered.
 */
export function MswGate({ setsKey, children }: { setsKey: string; children: ReactNode }) {
  const [installedKey, setInstalledKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const names = setsKey ? setsKey.split("|") : [];
    startWorkerOnce().then(() => {
      if (!active) return;
      worker.resetHandlers();
      for (const name of names) {
        worker.use(...createHandlers(name as HandlerSet));
      }
      setInstalledKey(setsKey);
    });
    return () => {
      active = false;
    };
  }, [setsKey]);

  if (installedKey !== setsKey) {
    return null;
  }
  return <>{children}</>;
}
