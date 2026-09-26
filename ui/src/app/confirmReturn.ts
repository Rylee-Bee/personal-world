/**
 * "Confirm it's you" by signing in to the provider again leaves the page
 * (GET /api/auth/oidc/step-up), and Worlds switches pages without changing
 * the address. So the page a person was on is remembered in this tab only
 * (sessionStorage), and restored with one line when they come back.
 */
const CURRENT = "pw-current-area";
const RETURN = "pw-confirm-return";

function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Called by App on every page change. */
export function noteCurrentArea(area: string): void {
  try {
    store()?.setItem(CURRENT, area);
  } catch {
    /* storage blocked: returning lands on the Bridge */
  }
}

/** Send the person to the provider to confirm it's them, remembering the page. */
export function confirmWithSignIn(): void {
  const s = store();
  try {
    s?.setItem(RETURN, s.getItem(CURRENT) ?? "overview");
  } catch {
    /* storage blocked: they come back to the Bridge */
  }
  window.location.assign(`/api/auth/oidc/step-up?return_to=${encodeURIComponent("/")}`);
}

/** On load: the page to reopen after confirming, once. */
export function takeConfirmReturn(): string | null {
  const s = store();
  try {
    const area = s?.getItem(RETURN) ?? null;
    s?.removeItem(RETURN);
    return area;
  } catch {
    return null;
  }
}
