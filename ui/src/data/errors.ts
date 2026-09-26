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
  if (isStepUpGate(err)) return STEP_UP_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** True when the failure is the step-up gate (HTTP 403). Screens that
 *  can actually DO the elevation (Memory → Records) use this to render
 *  an "elevate first" invitation instead of the shared dead-end
 *  message above. */
export function isStepUpGate(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}

/** True when the failure is the locked-category read refusal
 * (HTTP 409 + status "locked" — the server's word is in ApiError.
 * message, lifted from the envelope's warnings). */
export function isLockedRefusal(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
}

/** True when a write was refused only because the session needs a
 *  fresh "Confirm it's you" (require_step_up), not because the person
 *  lacks the permission. */
export function needsConfirm(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && /step-up/i.test(err.message);
}
