/**
 * NotificationsSection — Settings in Worlds: notifications (Web Push),
 * in the look of the approved boards (canvas "Notifications" row:
 * Notify-Setup, Notify-Settings, Notify-Message; owner "YES!", 2026-09-26).
 *
 * One place to see and steer how Worlds reaches a person:
 *   - the state in plain words first, then a short checklist for THIS
 *     device (set up on the server · on the Home Screen, iPhone only ·
 *     allowed · turned on · test sent), each with a word and, when
 *     something needs a fix, one plain next step;
 *   - "Turn on notifications" — the ONLY place this app ever calls
 *     Notification.requestPermission(), and only from inside this
 *     button's press (push-client.ts owns that call). On iPhone Safari
 *     outside a Home Screen install the button is replaced by the
 *     three-step Add to Home Screen guide: iPhone only delivers Web Push
 *     to an installed app;
 *   - what reaches you (the three kinds, then each sender), quiet hours,
 *     your devices (labels and times only — endpoints and browser keys
 *     are credentials and never reach this screen) with "Send me a
 *     test", and the history, which is the record: nothing is lost if a
 *     push didn't arrive.
 *
 * Every switch says On or Off in words beside it. Sol keeps company
 * (hello while it's off, proud when it's on, oops when blocked); the
 * words carry everything.
 *
 * Server doors: GET/POST /api/push/*, GET/PUT /api/notifications/*
 * (docs/NOTIFICATIONS.md; manifest ids API-101/API-102). A 409 from
 * /api/push/public-key is the honest "not configured" answer — every
 * other door here works with or without a key.
 */

import { reportSticker } from "../../components/stickers/report";
import { useState, type ReactNode } from "react";
import { notifyManager, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getNotificationPrefs,
  getPushPublicKey,
  listNotifications,
  listPushSubscriptions,
  markAllNotificationsRead,
  markNotificationRead,
  putNotificationPrefs,
  removePushSubscription,
  sendTestNotification,
} from "../../data/api";
import { describeError } from "../../data/errors";
import { useMe } from "../../data/hooks";
import {
  DEFAULT_NOTIFICATION_PREFS,
  isStandaloneApp,
  isIosSafariNotStandalone,
  notificationPermission,
  subscribeThisDevice,
} from "../../data/push-client";
import { WorldButton } from "../../components/WorldButton";
import { SolMoment } from "../../components/SolMoment";
import { SpotArt } from "../../components/SpotArt";
import { formatTime } from "../../components/rooms/format";
import type {
  Envelope,
  NotificationItem,
  NotificationPrefs,
  PushDevice,
  TierName,
} from "../../data/contract";

const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const MICRO = "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]";
const CARD =
  "flex min-w-0 flex-col gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-lg)]";
const EYEBROW =
  "text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-accent-warm)]";
const CARD_TITLE =
  "text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)] [font-family:var(--pw-typography-font_serif,inherit)]";
const INPUT =
  "min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] px-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]";
const CHIP =
  "inline-block rounded-[var(--pw-radius-sm)] border border-[var(--pw-accent-warm)] px-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-bold uppercase tracking-[0.08em] text-[var(--pw-text-primary)]";

const PREFS_KEY = ["notifications", "prefs"];
const DEVICES_KEY = ["push", "subscriptions"];
const HISTORY_KEY = ["notifications", "history"];
const HISTORY_SHOWN = 10;

const TIERS: { key: TierName; label: string; blurb: string }[] = [
  { key: "good_news", label: "Good news", blurb: "Finished work and things that went right. Reminders come as good news too." },
  { key: "update", label: "A small update", blurb: "Changes worth knowing. Most people read these in the history instead." },
  { key: "when_ready", label: "When you're ready", blurb: "Something is waiting for you. Never urgent." },
];

const TIER_WORDS: Record<TierName, string> = {
  good_news: "Good news",
  update: "A small update",
  when_ready: "When you're ready",
};

const SOURCE_NAMES: Record<string, string> = {
  vefr: "VEFR",
  candy: "Candy",
  worlds: "Worlds",
  agents: "Agents",
  reminders: "Reminders",
  "hive-works": "Hive Works",
};

/** A sender's name in words: known rooms by name, else the word itself. */
function sourceName(source: string): string {
  const known = SOURCE_NAMES[source.toLowerCase()];
  if (known) return known;
  const words = source.replace(/[_:-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Worlds";
}

type Step = "Worked" | "Needs a fix" | "Not yet" | "Not possible";

const STEP_TONE: Record<Step, string> = {
  Worked: "border-[var(--pw-accent-green)] bg-[var(--pw-accent-green)]",
  "Needs a fix": "border-[var(--pw-accent-coral)] bg-transparent",
  "Not yet": "border-[var(--pw-text-muted)] bg-transparent",
  "Not possible": "border-[var(--pw-text-muted)] bg-transparent",
};

function CheckRow({ label, step, detail }: { label: string; step: Step; detail?: ReactNode }) {
  return (
    <li className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-[var(--pw-spacing-sm)] gap-y-[var(--pw-spacing-xs)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)]">
      <span aria-hidden="true" className={`h-[14px] w-[14px] rounded-full border-2 ${STEP_TONE[step]}`} />
      <span className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">{label}</span>
      <span className="text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-secondary)]">{step}</span>
      {detail ? <span className={`col-start-2 col-end-4 ${SMALL}`}>{detail}</span> : null}
    </li>
  );
}

/** A switch that says On or Off in words. A real checkbox (role switch)
 *  under a 44px label, so a tap anywhere on the row flips it. */
function Switch({
  id,
  title,
  blurb,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  title: string;
  blurb?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-[var(--pw-targets-minimum)] items-center gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)] ${
        disabled ? "cursor-progress opacity-70" : "cursor-pointer"
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">{title}</span>
        {blurb ? <span className={SMALL}>{blurb}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={`min-w-[2.2em] text-[length:var(--pw-typography-size_small)] font-bold ${
          checked ? "text-[var(--pw-accent-warm)]" : "text-[var(--pw-text-muted)]"
        }`}
      >
        {checked ? "On" : "Off"}
      </span>
      <span
        className={`relative h-[30px] w-[52px] shrink-0 rounded-full border-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--pw-accent-primary)] ${
          checked
            ? "border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm)]"
            : "border-[var(--pw-text-muted)] bg-[var(--pw-surface-void)]"
        }`}
      >
        {/* The real control: invisible, laid over the track, so taps,
            clicks and voice control all land on a genuine checkbox. */}
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-progress"
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-[3px] h-[20px] w-[20px] rounded-full ${
            checked ? "right-[3px] bg-[var(--pw-surface-void)]" : "left-[3px] bg-[var(--pw-text-muted)]"
          }`}
        />
      </span>
    </label>
  );
}

/** What a notification looks like on a phone: Sol as the icon, the
 *  sender in the heading, the kind as the title, one sentence. */
function ExampleNotification() {
  return (
    <figure className="m-0 flex flex-col gap-[var(--pw-spacing-xs)]">
      <figcaption className={MICRO}>For example:</figcaption>
      <div className="flex items-start gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-sm)]">
        <SolMoment mood="mark" size={36} className="shrink-0 rounded-[var(--pw-radius-sm)]" />
        <div className="min-w-0 flex-1">
          <p className={`${MICRO} flex justify-between font-bold`}>
            <span>WORLDS · Studio</span>
            <span className="font-normal">now</span>
          </p>
          <p className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">Good news</p>
          <p className={SMALL}>Studio finished drafting chapter three.</p>
        </div>
      </div>
    </figure>
  );
}

function IphoneGuide() {
  return (
    <div
      role="note"
      className="flex flex-col gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-md)] border border-[var(--pw-accent-warm)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]"
    >
      <p className="flex items-center gap-[var(--pw-spacing-sm)] font-semibold text-[var(--pw-text-primary)]">
        <SolMoment mood="hello" size={44} />
        Put Worlds on your Home Screen
      </p>
      <p className={SMALL}>
        On iPhone, notifications only work once you add Worlds to your Home Screen. It takes three taps:
      </p>
      <ol className={`${SMALL} list-decimal pl-[var(--pw-spacing-lg)]`}>
        <li>
          Tap <strong className="text-[var(--pw-text-primary)]">Share</strong> at the bottom of Safari.
        </li>
        <li>
          Choose <strong className="text-[var(--pw-text-primary)]">Add to Home Screen</strong>.
        </li>
        <li>Open Worlds from its new icon, then come back here.</li>
      </ol>
    </div>
  );
}

/** "21:00" → "9:00 PM" in the reader's own clock style; anything
 *  unreadable is shown as the server sent it. */
function wallTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return hhmm;
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function deviceWords(d: PushDevice): string {
  if (d.last_error) return `The last delivery didn’t arrive: ${d.last_error}`;
  if (d.last_ok_at) return `Last reached ${formatTime(d.last_ok_at)}`;
  return d.created_at ? `Added ${formatTime(d.created_at)} · waiting for the first delivery` : "Waiting for the first delivery";
}

export function NotificationsSection() {
  const queryClient = useQueryClient();
  const me = useMe();
  const isOwner = (me.data?.data?.permissions ?? []).includes("manage_people");
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [testResult, setTestResult] = useState<{ text: string; tone: "ok" | "error"; sent: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // The public-key door doubles as the configuration probe: its 409 is
  // an answer ("this server has no push key"), so it is never retried.
  const keyQuery = useQuery({
    queryKey: ["push", "public-key"],
    queryFn: getPushPublicKey,
    retry: (count, err) => !(err instanceof ApiError && err.status === 409) && count < 2,
  });
  const configured = !keyQuery.isError;

  const devicesQuery = useQuery({
    queryKey: DEVICES_KEY,
    queryFn: listPushSubscriptions,
    enabled: configured,
  });
  const prefsQuery = useQuery({
    queryKey: PREFS_KEY,
    queryFn: getNotificationPrefs,
  });
  const historyQuery = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => listNotifications({ limit: HISTORY_SHOWN }),
  });

  // Until the server's own prefs land, the switches are disabled: they
  // would otherwise show (and let you change) the defaults, which the
  // in-flight answer then silently rewrites.
  const prefsLoading = prefsQuery.isPending;
  // The value just pressed, held in React state: query-core delivers
  // cache updates on a batched macrotask, so a cache-only optimistic
  // write would render the switch straight back to the old value in
  // this very click event. The server's answer replaces it when it
  // arrives; a refused save rolls back.
  const [pendingPrefs, setPendingPrefs] = useState<NotificationPrefs | null>(null);
  const prefs: NotificationPrefs = pendingPrefs ?? prefsQuery.data?.data ?? DEFAULT_NOTIFICATION_PREFS;
  const devices: PushDevice[] = devicesQuery.data?.data ?? [];
  const history: NotificationItem[] = historyQuery.data?.data ?? [];
  const unread = history.filter((n) => !n.read_at).length;
  const permission = notificationPermission();
  const iphoneTab = isIosSafariNotStandalone();
  const onIphone = iphoneTab || (isStandaloneApp() && /iPhone|iPad/.test(typeof navigator !== "undefined" ? navigator.userAgent : ""));

  const turnOn = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const key = keyQuery.data?.data?.public_key;
      if (!key) throw new Error("this server is not set up for notifications");
      await subscribeThisDevice(key);
      await queryClient.invalidateQueries({ queryKey: DEVICES_KEY });
      setMessage({ text: "Notifications are on for this device.", tone: "ok" });
    } catch (err) {
      setMessage({ text: describeError(err, "Couldn’t turn on notifications."), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = useMutation({
    mutationFn: (body: NotificationPrefs) => putNotificationPrefs(body),
    onSuccess: (envelope) => {
      // batch(): write the server's truth and release the optimistic
      // value in one notification pass, so no render in between can
      // show the stale pre-click prefs.
      notifyManager.batch(() => {
        queryClient.setQueryData<Envelope<NotificationPrefs>>(PREFS_KEY, envelope);
        setPendingPrefs(null);
      });
      setMessage(null);
    },
    onError: (err) => {
      notifyManager.batch(() => {
        setPendingPrefs(null);
        void queryClient.invalidateQueries({ queryKey: PREFS_KEY });
      });
      setMessage({ text: describeError(err, "Couldn’t save that. Nothing changed."), tone: "error" });
    },
  });

  // The one path that changes prefs: move the control now (inside this
  // event), tell the server, and let its answer take over.
  const applyPrefs = (next: NotificationPrefs) => {
    setPendingPrefs(next);
    savePrefs.mutate(next, {
      onSuccess: () => {
        if (JSON.stringify(next.quiet_hours) !== JSON.stringify(prefs.quiet_hours) && next.quiet_hours.on) void reportSticker("quiet-hours");
      },
    });
  };
  const setTier = (tier: TierName, on: boolean) => applyPrefs({ ...prefs, tiers: { ...prefs.tiers, [tier]: on } });
  const setSource = (source: string, on: boolean) =>
    applyPrefs({ ...prefs, sources: { ...prefs.sources, [source]: on } });

  const removeDevice = useMutation({
    mutationFn: (id: string) => removePushSubscription(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
    onError: (err) => setMessage({ text: describeError(err, "Couldn’t remove that device."), tone: "error" }),
  });

  // "Send me a test" goes out straight away, even in quiet hours, so it
  // says "Test sent" the moment the server has pushed it.
  const sendTest = useMutation({
    mutationFn: () => sendTestNotification(),
    onSuccess: (envelope) => {
      const outcome = envelope.data;
      const n = outcome?.delivered ?? 0;
      setTestResult(
        n > 0
          ? { text: `Test sent to ${n === 1 ? "1 device" : `${n} devices`}. It should arrive in a moment.`, tone: "ok", sent: true }
          : {
              text: "The test is in your history, but no device is turned on yet, so nothing buzzed.",
              tone: "ok",
              sent: false,
            },
      );
      void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (err) => setTestResult({ text: describeError(err, "The test didn’t go out."), tone: "error", sent: false }),
  });

  const clearUnread = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Sources are whatever this person (or a publish) has named so far —
  // the prefs store is the only list, and an unknown source pushes by
  // default.
  const knownSources = [...new Set(Object.keys(prefs.sources))].sort();

  // The plain-words state, shown before every control.
  const stateWords = keyQuery.isPending
    ? "Checking…"
    : !configured
      ? "Notifications are not configured on this server yet."
      : permission === "denied"
        ? "Notifications are blocked for this site in your browser settings. Allow them there, then reload."
        : permission === "unsupported"
          ? "This browser has no notifications to turn on."
          : devices.length > 0
            ? "Notifications are on."
            : iphoneTab
              ? "Notifications are off on this device: iPhone delivers them only through an installed app."
              : "Notifications are off on this device.";

  const mood = !configured || permission === "denied" ? "oops" : devices.length > 0 ? "proud" : "hello";
  const showTurnOn = configured && permission !== "denied" && permission !== "unsupported" && !iphoneTab;

  const serverStep: Step = keyQuery.isPending ? "Not yet" : configured ? "Worked" : "Needs a fix";
  const allowedStep: Step =
    permission === "granted" ? "Worked" : permission === "denied" ? "Needs a fix" : permission === "unsupported" ? "Not possible" : "Not yet";

  return (
    <section
      aria-labelledby="settings-notifications-heading"
      className="mb-[var(--pw-spacing-2xl)] flex flex-col gap-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <header className="flex items-center gap-[var(--pw-spacing-md)]">
        <SolMoment mood={mood} size={64} />
        <div className="min-w-0 flex-1">
          <h2
            id="settings-notifications-heading"
            className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)] [font-family:var(--pw-typography-font_serif,inherit)]"
          >
            Notifications
          </h2>
          <p className={SMALL}>
            Worlds tells you when something is worth knowing, under its own name and icon. Quiet by default.
          </p>
        </div>
      </header>

      <p role="status" className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">
        {stateWords}
      </p>

      <div className="grid gap-[var(--pw-spacing-lg)] lg:grid-cols-2">
        <section aria-labelledby="notif-device-heading" className={CARD}>
          <div>
            <p className={EYEBROW}>This device</p>
            <h3 id="notif-device-heading" className={CARD_TITLE}>
              Notifications on this device
            </h3>
          </div>
          <ul aria-label="How this device is set up" className="flex flex-col">
            <CheckRow
              label="Set up on the server"
              step={serverStep}
              detail={
                serverStep === "Needs a fix"
                  ? isOwner
                    ? "Next step: run personal-world push keygen and add its two lines to the server (docs/NOTIFICATIONS.md, one page)."
                    : "Next step: ask the person who runs this World to add a push key."
                  : undefined
              }
            />
            {onIphone ? (
              <CheckRow
                label="On your Home Screen"
                step={iphoneTab ? "Needs a fix" : "Worked"}
                detail={iphoneTab ? "Next step: add Worlds to your Home Screen (below)." : undefined}
              />
            ) : null}
            <CheckRow
              label="Allowed"
              step={allowedStep}
              detail={
                allowedStep === "Needs a fix"
                  ? onIphone
                    ? "Next step: open iPhone Settings › Notifications › Worlds, turn on Allow Notifications, then come back."
                    : "Next step: allow notifications for this site in your browser’s settings, then reload."
                  : allowedStep === "Not possible"
                    ? "This browser can’t show notifications."
                    : undefined
              }
            />
            <CheckRow label="Turned on" step={devices.length > 0 ? "Worked" : "Not yet"} />
            <CheckRow
              label="Test sent"
              step={testResult?.sent ? "Worked" : "Not yet"}
              detail={testResult?.sent ? undefined : devices.length > 0 ? "Press Send me a test to see how it looks." : undefined}
            />
          </ul>

          {iphoneTab && configured ? <IphoneGuide /> : null}

          {showTurnOn ? (
            <div className="flex flex-col gap-[var(--pw-spacing-sm)]">
              {devices.length > 0 && isStandaloneApp() ? (
                <p className={SMALL}>This device is already on. Turning it on again only refreshes it.</p>
              ) : null}
              <WorldButton variant="primary" onPress={() => void turnOn()} isDisabled={busy} className="self-start">
                {busy ? "Turning on…" : "Turn on notifications"}
              </WorldButton>
              <p className={MICRO}>Your device asks once. You can turn it off here or in its own settings.</p>
            </div>
          ) : null}

          {message ? (
            <p role={message.tone === "error" ? "alert" : "status"} className={SMALL}>
              {message.text}
            </p>
          ) : null}

          <ExampleNotification />
        </section>

        <section aria-labelledby="notif-kinds-heading" className={CARD}>
          <div>
            <p className={EYEBROW}>What you get</p>
            <h3 id="notif-kinds-heading" className={CARD_TITLE}>
              What reaches you
            </h3>
          </div>
          <div className="flex flex-col">
            {TIERS.map((tier) => (
              <Switch
                key={tier.key}
                id={`notif-tier-${tier.key}`}
                title={tier.label}
                blurb={tier.blurb}
                checked={prefs.tiers[tier.key]}
                disabled={prefsLoading}
                onChange={(next) => setTier(tier.key, next)}
              />
            ))}
          </div>
          {knownSources.length > 0 ? (
            <div className="flex flex-col">
              <p className={EYEBROW}>Who can send</p>
              <p className={`${SMALL} mb-[var(--pw-spacing-xs)]`}>A sender you turn off is kept in the history only.</p>
              {knownSources.map((source) => (
                <Switch
                  key={source}
                  id={`notif-source-${source}`}
                  title={sourceName(source)}
                  checked={prefs.sources[source] !== false}
                  disabled={prefsLoading}
                  onChange={(next) => setSource(source, next)}
                />
              ))}
            </div>
          ) : (
            <p className={SMALL}>Senders like VEFR and Candy appear here the first time they send you something.</p>
          )}
        </section>

        <section aria-labelledby="notif-quiet-heading" className={CARD}>
          <div className="flex items-center gap-[var(--pw-spacing-md)]">
            <SpotArt name="quiet" size={56} />
            <div className="min-w-0">
              <p className={EYEBROW}>{`Quiet hours · ${prefs.quiet_hours.on ? "on" : "off"}`}</p>
              <h3 id="notif-quiet-heading" className={CARD_TITLE}>
                {prefs.quiet_hours.on
                  ? `Quiet from ${wallTime(prefs.quiet_hours.start)} to ${wallTime(prefs.quiet_hours.end)}`
                  : "No quiet hours"}
              </h3>
            </div>
          </div>
          <Switch
            id="notif-quiet-on"
            title="Keep the night quiet"
            blurb="Nothing buzzes. It all waits in the history, and one short summary arrives when quiet hours end."
            checked={prefs.quiet_hours.on}
            disabled={prefsLoading}
            onChange={(next) => applyPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, on: next } })}
          />
          <div className="flex flex-wrap gap-[var(--pw-spacing-md)]">
            <span className="flex flex-col gap-[var(--pw-spacing-xs)]">
              <label htmlFor="notif-quiet-start" className="text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]">
                From
              </label>
              <input
                id="notif-quiet-start"
                type="time"
                disabled={prefsLoading}
                value={prefs.quiet_hours.start}
                onChange={(e) => applyPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, start: e.target.value } })}
                className={INPUT}
              />
            </span>
            <span className="flex flex-col gap-[var(--pw-spacing-xs)]">
              <label htmlFor="notif-quiet-end" className="text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]">
                Until
              </label>
              <input
                id="notif-quiet-end"
                type="time"
                disabled={prefsLoading}
                value={prefs.quiet_hours.end}
                onChange={(e) => applyPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, end: e.target.value } })}
                className={INPUT}
              />
            </span>
          </div>
          <p className={MICRO}>
            {`Times are on this World’s clock${prefs.quiet_hours.tz ? ` (${prefs.quiet_hours.tz})` : ""}. Send me a test always goes straight through.`}
          </p>
        </section>

        <section aria-labelledby="notif-devices-heading" className={CARD}>
          <div>
            <p className={EYEBROW}>Where they go</p>
            <h3 id="notif-devices-heading" className={CARD_TITLE}>
              Devices
            </h3>
          </div>
          {!configured ? (
            <p className={SMALL}>Devices appear here once notifications are set up on the server.</p>
          ) : devices.length === 0 ? (
            <p className={SMALL}>No devices yet. Turn on notifications on each phone or computer you want them on.</p>
          ) : (
            <ul className="flex flex-col">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)]"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[length:var(--pw-typography-size_body)] font-semibold text-[var(--pw-text-primary)]">
                      {d.device_label}
                    </span>
                    <span className={SMALL}>{deviceWords(d)}</span>
                  </span>
                  <WorldButton
                    variant="ghost"
                    aria-label={`Remove ${d.device_label}`}
                    isDisabled={removeDevice.isPending}
                    onPress={() => removeDevice.mutate(d.id)}
                  >
                    Remove
                  </WorldButton>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
            <WorldButton variant="primary" isDisabled={sendTest.isPending} onPress={() => sendTest.mutate()}>
              {sendTest.isPending ? "Sending…" : "Send me a test"}
            </WorldButton>
          </div>
          {testResult ? (
            <p role={testResult.tone === "error" ? "alert" : "status"} className={SMALL}>
              {testResult.text}
            </p>
          ) : null}
          <p className={MICRO}>Away from home, opening a notification needs a way to reach your World. For now, that’s your VPN.</p>
        </section>
      </div>

      <section aria-labelledby="notif-history-heading" className={CARD}>
        <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
          <SpotArt name="journal" size={56} />
          <div className="min-w-[12rem] flex-1">
            <p className={EYEBROW}>{unread > 0 ? `History · ${unread} new` : "History"}</p>
            <h3 id="notif-history-heading" className={CARD_TITLE}>
              Everything Worlds told you
            </h3>
          </div>
          {unread > 0 ? (
            <WorldButton variant="ghost" isDisabled={clearUnread.isPending} onPress={() => clearUnread.mutate()}>
              Mark all as read
            </WorldButton>
          ) : null}
        </div>
        {historyQuery.isError ? (
          <p className={SMALL}>Couldn’t load the history just now. Nothing in it is lost.</p>
        ) : history.length === 0 ? (
          <p className={SMALL}>{historyQuery.isPending ? "Loading…" : "Nothing yet. Notifications land here even when nothing buzzes."}</p>
        ) : (
          <ul className="flex flex-col">
            {history.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] py-[var(--pw-spacing-sm)]"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[var(--pw-spacing-xs)]">
                  <span className="flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
                    <span className={CHIP}>{TIER_WORDS[n.tier] ?? n.tier_words}</span>
                    {!n.read_at ? (
                      <span className="text-[length:var(--pw-typography-size_label)] font-bold text-[var(--pw-accent-warm)]">New</span>
                    ) : null}
                  </span>
                  <span
                    className={`text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] ${n.read_at ? "" : "font-semibold"}`}
                  >
                    {n.title}
                  </span>
                  {n.body ? <span className={SMALL}>{n.body}</span> : null}
                  <span className={MICRO}>
                    {[sourceName(n.source), n.created_at ? formatTime(n.created_at) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? (
                  <a
                    href={n.link}
                    onClick={() => {
                      if (!n.read_at) void markNotificationRead(n.id).catch(() => undefined);
                    }}
                    aria-label={`Open “${n.title}”`}
                    className="inline-flex min-h-[var(--pw-targets-minimum)] items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] px-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pw-accent-primary)]"
                  >
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className={MICRO}>Nothing is lost if a notification didn’t arrive: it’s always here. Kept for 90 days.</p>
      </section>
    </section>
  );
}
