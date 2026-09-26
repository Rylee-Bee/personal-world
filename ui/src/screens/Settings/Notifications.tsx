/**
 * NotificationsSection — Settings in Worlds: notifications (Web Push).
 *
 * One place to see and steer how Worlds reaches a person's phone:
 *   - the state in plain words first (not configured on the server /
 *     not installed as an app on iPhone / off / on for this device /
 *     blocked) — never a bare boolean;
 *   - "Turn on for this device" — the ONLY place this app ever calls
 *     Notification.requestPermission(), and only from inside this
 *     button's press, which is what the browser's user-gesture rule
 *     requires (push-client.ts owns that call);
 *   - the device list (labels and times only — endpoints and browser
 *     keys are credentials and never reach this screen), each removable;
 *   - tier and source toggles, quiet hours, and "Send me a test".
 *
 * On iPhone Safari that is not standing alone as an installed app the
 * button is replaced by the Add-to-Home-Screen directions: iPhone only
 * delivers Web Push through a Home Screen install.
 *
 * Server doors: GET/POST /api/push/*, GET/PUT /api/notifications/*
 * (docs/NOTIFICATIONS.md; manifest ids API-101/API-102). A 409 from
 * /api/push/public-key is the honest "not configured" answer — every
 * other door here works with or without a key.
 */

import { useState } from "react";
import { notifyManager, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getNotificationPrefs,
  getPushPublicKey,
  listPushSubscriptions,
  markAllNotificationsRead,
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
import type {
  Envelope,
  NotificationPrefs,
  PushDevice,
  TierName,
} from "../../data/contract";

const SMALL =
  "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const TINY =
  "text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]";
const HEADING3 =
  "text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]";
const INPUT =
  "rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-sm)] py-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]";

const PREFS_KEY = ["notifications", "prefs"];
const DEVICES_KEY = ["push", "subscriptions"];

const TIERS: { key: TierName; label: string; blurb: string }[] = [
  { key: "good_news", label: "Good news", blurb: "things worth a look right away" },
  {
    key: "update",
    label: "A small update",
    blurb: "day-to-day happenings (reminders ride here)",
  },
  {
    key: "when_ready",
    label: "When you're ready",
    blurb: "quiet by default: kept in history, off until you turn it on",
  },
];

function ToggleRow({
  id,
  title,
  blurb,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  title: string;
  blurb: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-[var(--pw-spacing-md)]">
      <div>
        <label htmlFor={id} className={`block ${HEADING3}`}>
          {title}
        </label>
        <p className={TINY}>{blurb}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[var(--pw-spacing-xs)] h-[var(--pw-targets-minimum)] w-[var(--pw-targets-minimum)] shrink-0 accent-[var(--pw-accent-warm)]"
      />
    </div>
  );
}

export function NotificationsSection() {
  const queryClient = useQueryClient();
  const me = useMe();
  const isOwner = (me.data?.data?.permissions ?? []).includes("manage_people");
  const [message, setMessage] = useState<{
    text: string;
    tone: "ok" | "error";
  } | null>(null);
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
  const prefs: NotificationPrefs =
    pendingPrefs ?? prefsQuery.data?.data ?? DEFAULT_NOTIFICATION_PREFS;
  const devices: PushDevice[] = devicesQuery.data?.data ?? [];
  const permission = notificationPermission();

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
      setMessage({
        text: describeError(err, "Could not turn on notifications."),
        tone: "error",
      });
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
      setMessage({
        text: describeError(err, "Could not save preferences."),
        tone: "error",
      });
    },
  });

  // The one path that changes prefs: move the control now (inside this
  // event), tell the server, and let its answer take over.
  const applyPrefs = (next: NotificationPrefs) => {
    setPendingPrefs(next);
    savePrefs.mutate(next);
  };

  const setTier = (tier: TierName, on: boolean) =>
    applyPrefs({ ...prefs, tiers: { ...prefs.tiers, [tier]: on } });

  const setSource = (source: string, on: boolean) =>
    applyPrefs({ ...prefs, sources: { ...prefs.sources, [source]: on } });

  const removeDevice = useMutation({
    mutationFn: (id: string) => removePushSubscription(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
    onError: (err) =>
      setMessage({
        text: describeError(err, "Could not remove the device."),
        tone: "error",
      }),
  });

  const sendTest = useMutation({
    mutationFn: () => sendTestNotification(),
    onSuccess: (envelope) => {
      const outcome = envelope.data;
      setMessage({
        text:
          outcome && outcome.delivered > 0
            ? "Test sent — it should arrive shortly."
            : `The test was stored${
                outcome?.deferred
                  ? " (quiet hours keep it waiting for now)"
                  : ""
              }, but nothing was pushed to a device.`,
        tone: "ok",
      });
    },
    onError: (err) =>
      setMessage({
        text: describeError(err, "The test did not go out."),
        tone: "error",
      }),
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
            : isIosSafariNotStandalone()
              ? "Notifications are off on this device: iPhone delivers them only through an installed app."
              : "Notifications are off on this device.";

  const showTurnOnButton =
    configured && permission !== "denied" && !isIosSafariNotStandalone();
  const showIosInstructions = configured && isIosSafariNotStandalone();

  return (
    <section
      aria-labelledby="settings-notifications-heading"
      className="mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h2
        id="settings-notifications-heading"
        className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)] [font-family:var(--pw-typography-font_serif,inherit)]"
      >
        Notifications
      </h2>

      <p role="status" className={`mb-[var(--pw-spacing-lg)] ${SMALL}`}>
        {stateWords}
      </p>

      {!configured ? (
        <p className={TINY}>
          {isOwner
            ? "To turn them on, add a push key to this server: personal-world push keygen, then docs/NOTIFICATIONS.md explains the two environment lines."
            : "To turn them on, the person who runs this World adds a push key (docs/NOTIFICATIONS.md explains it in one page)."}
        </p>
      ) : null}

      {showTurnOnButton ? (
        <div className="mb-[var(--pw-spacing-lg)]">
          {devices.length > 0 && isStandaloneApp() ? (
            <p className={`${SMALL} mb-[var(--pw-spacing-sm)]`}>
              This device is already on the list below — turning it on
              again only refreshes its keys.
            </p>
          ) : null}
          <WorldButton
            variant="primary"
            onPress={() => void turnOn()}
            isDisabled={busy}
          >
            Turn on for this device
          </WorldButton>
        </div>
      ) : null}

      {showIosInstructions ? (
        <div
          role="note"
          className="mb-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
        >
          <p className={`${SMALL} font-medium`}>
            To get notifications on iPhone, add Worlds to your Home
            Screen: Share, then Add to Home Screen, then open it from
            there.
          </p>
        </div>
      ) : null}

      {configured ? (
        <section aria-label="Devices" className="mb-[var(--pw-spacing-xl)]">
          <h3 className={`mb-[var(--pw-spacing-sm)] ${HEADING3}`}>Devices</h3>
          {devices.length === 0 ? (
            <p className={TINY}>No devices yet.</p>
          ) : (
            <ul className="space-y-[var(--pw-spacing-sm)]">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-[var(--pw-spacing-md)]"
                >
                  <span className={SMALL}>
                    {d.device_label}
                    <span className={` ml-[var(--pw-spacing-sm)] ${TINY}`}>
                      {d.last_error
                        ? `last delivery said: ${d.last_error}`
                        : d.last_ok_at
                          ? `last reached ${d.last_ok_at}`
                          : "waiting for the first delivery"}
                    </span>
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
        </section>
      ) : null}

      <section
        aria-label="What reaches you"
        className="mb-[var(--pw-spacing-xl)] space-y-[var(--pw-spacing-md)]"
      >
        <h3 className={HEADING3}>What reaches you</h3>
        {TIERS.map((tier) => (
          <ToggleRow
            key={tier.key}
            id={`notif-tier-${tier.key}`}
            title={tier.label}
            blurb={tier.blurb}
            checked={prefs.tiers[tier.key]}
            disabled={prefsLoading}
            onChange={(next) => setTier(tier.key, next)}
          />
        ))}
        {knownSources.length > 0 ? (
          <div className="space-y-[var(--pw-spacing-sm)] pt-[var(--pw-spacing-sm)]">
            <p className={TINY}>
              Per source — a source you switch off is kept in history only.
            </p>
            {knownSources.map((source) => (
              <ToggleRow
                key={source}
                id={`notif-source-${source}`}
                title={source.replaceAll("_", " ")}
                blurb={
                  prefs.sources[source] === false
                    ? "kept in history only"
                    : "pushes as the tiers allow"
                }
                checked={prefs.sources[source] !== false}
                disabled={prefsLoading}
                onChange={(next) => setSource(source, next)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section
        aria-label="Quiet hours"
        className="mb-[var(--pw-spacing-xl)] space-y-[var(--pw-spacing-sm)]"
      >
        <h3 className={HEADING3}>Quiet hours</h3>
        <ToggleRow
          id="notif-quiet-on"
          title="Keep the night quiet"
          blurb="Notifications still store, but wait; one short summary arrives when quiet hours end."
          checked={prefs.quiet_hours.on}
          disabled={prefsLoading}
          onChange={(next) =>
            applyPrefs({
              ...prefs,
              quiet_hours: { ...prefs.quiet_hours, on: next },
            })
          }
        />
        <div className="flex flex-wrap items-center gap-[var(--pw-spacing-lg)]">
          <span className="flex items-center gap-[var(--pw-spacing-sm)]">
            <label htmlFor="notif-quiet-start" className={SMALL}>
              From
            </label>
            <input
              id="notif-quiet-start"
              type="time"
              disabled={prefsLoading}
              value={prefs.quiet_hours.start}
              onChange={(e) =>
                applyPrefs({
                  ...prefs,
                  quiet_hours: { ...prefs.quiet_hours, start: e.target.value },
                })
              }
              className={INPUT}
            />
          </span>
          <span className="flex items-center gap-[var(--pw-spacing-sm)]">
            <label htmlFor="notif-quiet-end" className={SMALL}>
              Until
            </label>
            <input
              id="notif-quiet-end"
              type="time"
              disabled={prefsLoading}
              value={prefs.quiet_hours.end}
              onChange={(e) =>
                applyPrefs({
                  ...prefs,
                  quiet_hours: { ...prefs.quiet_hours, end: e.target.value },
                })
              }
              className={INPUT}
            />
          </span>
        </div>
        <p className={TINY}>
          Times are read on this server's clock
          {prefs.quiet_hours.tz ? ` (${prefs.quiet_hours.tz})` : ""}.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
        <WorldButton
          variant="secondary"
          isDisabled={sendTest.isPending}
          onPress={() => sendTest.mutate()}
        >
          Send me a test
        </WorldButton>
        <WorldButton
          variant="ghost"
          isDisabled={clearUnread.isPending}
          onPress={() => clearUnread.mutate()}
        >
          Mark everything read
        </WorldButton>
      </div>

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-[var(--pw-spacing-md)] ${SMALL}`}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
