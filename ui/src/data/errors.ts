/**
 * Error-to-words mapping for mutation failures.
 *
 * The step-up gate (backend 403) must never fail silently — the user is
 * told what happened and that the flow is incomplete in this build.
 */

import { ApiError } from "./api";

export const STEP_UP_MESSAGE =
  "This change needs re-authentication — not yet available in this build.";

/** Map a failure to honest human words (403 = step-up gate). */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 403) return STEP_UP_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
