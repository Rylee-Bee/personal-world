/**
 * The browser side of Web Push: registration, permission, subscribing.
 *
 * Nothing here speaks React, and nothing here talks to the API except
 * through data/api.ts (auth rides the same session as every other
 * call). The one hard rule lives in `subscribeThisDevice`: it is the
 * ONLY place `Notification.requestPermission()` is ever called, and
 * only from inside a real button press — browsers refuse otherwise,
 * and nagging prompts are exactly what this product is against.
 *
 * docs/NOTIFICATIONS.md has the full picture (server keys, iPhone
 * Home Screen steps); this file is only the device half.
 */

import { registerPushSubscription } from "./api";

/** The prefs shape before the server's answer arrives — identical to
 *  the server defaults (quiet by default). */
export const DEFAULT_NOTIFICATION_PREFS = {
  tiers: { good_news: true, update: true, when_ready: false },
  sources: {},
  quiet_hours: { on: true, start: "21:00", end: "08:00", tz: null },
} as const;

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/** Push needs a secure context: https, or plain http on localhost
 *  (the dev case browsers always allow). Everywhere else the service
 *  worker registration is skipped, not faked. */
export function isSecureEndpoint(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari keeps its own flag; it is the only way to know a Home
  // Screen install is running standalone there.
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone (incl. iPadOS-on-Mac-Safari-13 style UAs) in a normal Safari
 *  tab, NOT standing alone as an installed app: push is impossible
 *  there, and the Settings section says so with the Add-to-Home-Screen
 *  directions instead of offering a button that cannot work. */
export function isIosSafariNotStandalone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && "ontouchend" in document);
  return iOS && !isStandaloneApp();
}

/** The device label the person sees in their list, read off the
 *  browser's own words. Never anything more identifying than "iPhone". */
export function deviceLabel(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  return "This device";
}

/** Register /sw.js at site-root scope. Called once on app load, https
 *  or localhost only, and never on iPhone Safari tabs where push can
 *  not work anyway. Safe to call repeatedly: registrations dedupe. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported() || !isSecureEndpoint()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // A failed registration stays silent here: the Notifications
    // section reports the device list honestly either way.
    return null;
  }
}

// No return annotation on purpose: the inferred Uint8Array<ArrayBuffer>
// is what PushSubscriptionOptions.applicationServerKey wants (TS 5.9's
// stricter typed-array generics; a widened Uint8Array<ArrayBufferLike>
// is not assignable there).
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Tell the server about THIS browser's subscription (used right after
 *  subscribing, and after a keys-rotation resubscribe). */
export async function sendSubscriptionToServer(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const sub = await registration?.pushManager.getSubscription();
  if (!sub) throw new Error("this device is not subscribed yet");
  const json = sub.toJSON();
  await registerPushSubscription({
    subscription: {
      endpoint: json.endpoint ?? "",
      keys: (json.keys ?? {}) as { p256dh?: string; auth?: string },
    },
    device_label: deviceLabel(),
  });
}

/** The whole "Turn on for this device" gesture: ask the browser,
 *  subscribe with this server's VAPID public key, tell the server.
 *  Throws with plain words whenever a step refuses. */
export async function subscribeThisDevice(publicKey: string): Promise<void> {
  if (!pushSupported()) throw new Error("this browser has no push support");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("the browser did not allow notifications");
  }
  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await registerServiceWorker());
  if (!registration) throw new Error("the service worker did not start");
  await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await sendSubscriptionToServer();
}

/** Remove THIS browser's own subscription (the Settings list removes
 *  the server record; this cleans the browser side when it is ours). */
export async function unsubscribeThisDevice(): Promise<boolean> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const sub = await registration?.pushManager.getSubscription();
  if (!sub) return false;
  return sub.unsubscribe();
}
