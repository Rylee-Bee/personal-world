/**
 * Tests for the Settings Notifications section (Web Push).
 *
 * Same pattern as settings-room.test.tsx: the data layer is mocked at
 * its boundary. The component's job is to render STATE in words (the
 * five honest states from docs/NOTIFICATIONS.md), to hold the one
 * user-gesture rule (subscribe only from the button), and to send the
 * server's own prefs shape back unchanged — so those are what this
 * file asserts. The browser glue (push-client.ts) is mocked wholesale:
 * jsdom has no PushManager, and permission truth is a fixture here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { apiMocks, pushMocks } = vi.hoisted(() => {
  const DEFAULT_PREFS = {
    tiers: { good_news: true, update: true, when_ready: false },
    sources: {},
    quiet_hours: { on: true, start: "21:00", end: "08:00", tz: null },
  };
  return {
    apiMocks: {
      configured: true,
      devices: [] as {
        id: string;
        device_label: string;
        created_at: string | null;
        last_ok_at: string | null;
        last_error: string | null;
      }[],
      prefs: structuredClone(DEFAULT_PREFS),
    },
    pushMocks: {
      permission: "default" as string,
      iosNotStandalone: false,
      standalone: false,
      subscribe: vi.fn(async () => undefined),
    },
  };
});

vi.mock("../data/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/api")>();
  const envelope = <T,>(data: T) => Promise.resolve({ ok: true, data });
  return {
    ...actual,
    getPushPublicKey: vi.fn(() => {
      if (!apiMocks.configured) {
        return Promise.reject(
          new actual.ApiError(409, "push is not configured on this server"),
        );
      }
      return envelope({ public_key: "MOCK-PUBLIC-KEY" });
    }),
    listPushSubscriptions: vi.fn(() => envelope(apiMocks.devices)),
    getNotificationPrefs: vi.fn(() => envelope(apiMocks.prefs)),
    putNotificationPrefs: vi.fn((body) => {
      apiMocks.prefs = {
        tiers: { ...apiMocks.prefs.tiers, ...(body.tiers ?? {}) },
        sources: { ...apiMocks.prefs.sources, ...(body.sources ?? {}) },
        quiet_hours: { ...apiMocks.prefs.quiet_hours, ...(body.quiet_hours ?? {}) },
      };
      return envelope(structuredClone(apiMocks.prefs));
    }),
    removePushSubscription: vi.fn(async (id: string) => {
      apiMocks.devices = apiMocks.devices.filter((d) => d.id !== id);
      return { ok: true, data: { id, removed: true } };
    }),
    sendTestNotification: vi.fn(() =>
      envelope({ id: "n-1", delivered: 1, deferred: false, state: "delivered" }),
    ),
    markAllNotificationsRead: vi.fn(() => envelope({ read: 0 })),
  };
});

vi.mock("../data/push-client", () => ({
  DEFAULT_NOTIFICATION_PREFS: {
    tiers: { good_news: true, update: true, when_ready: false },
    sources: {},
    quiet_hours: { on: true, start: "21:00", end: "08:00", tz: null },
  },
  notificationPermission: () => pushMocks.permission,
  isStandaloneApp: () => pushMocks.standalone,
  isIosSafariNotStandalone: () => pushMocks.iosNotStandalone,
  subscribeThisDevice: pushMocks.subscribe,
}));

vi.mock("../data/hooks", () => ({
  useMe: () => ({
    data: { ok: true, data: { id: "sam", permissions: ["manage_people"] } },
  }),
}));

import { NotificationsSection } from "../screens/Settings/Notifications";

function renderSection() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <NotificationsSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiMocks.configured = true;
  apiMocks.devices = [];
  apiMocks.prefs = {
    tiers: { good_news: true, update: true, when_ready: false },
    sources: {},
    quiet_hours: { on: true, start: "21:00", end: "08:00", tz: null },
  };
  pushMocks.permission = "default";
  pushMocks.iosNotStandalone = false;
  pushMocks.standalone = false;
  pushMocks.subscribe.mockClear();
});

afterEach(cleanup);

describe("Notifications section", () => {
  it("leads with the plain-words state, and starts as 'off on this device'", async () => {
    renderSection();
    expect(await screen.findByText("Notifications are off on this device.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn on for this device" })).toBeTruthy();
  });

  it("says 'not configured on the server' and offers no button when the key door 409s", async () => {
    apiMocks.configured = false;
    renderSection();
    expect(
      await screen.findByText(/not configured on this server/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Turn on for this device" }),
    ).toBeNull();
  });

  it("shows the iPhone Home-Screen directions instead of the button (not standalone)", async () => {
    pushMocks.iosNotStandalone = true;
    renderSection();
    expect(
      await screen.findByText(/add Worlds to your Home Screen/i),
    ).toBeTruthy();
    expect(
      /Share, then Add to Home Screen, then open it from/.test(
        screen.getByRole("note").textContent ?? "",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Turn on for this device" }),
    ).toBeNull();
  });

  it("names the blocked state honestly and offers no button", async () => {
    pushMocks.permission = "denied";
    renderSection();
    expect(await screen.findByText(/blocked for this site/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Turn on for this device" }),
    ).toBeNull();
  });

  it("subscribes only from the button press, and confirms in words", async () => {
    const user = userEvent.setup();
    renderSection();
    // Rendering alone never reaches the browser's permission door.
    expect(pushMocks.subscribe).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole("button", { name: "Turn on for this device" }),
    );
    await waitFor(() =>
      expect(pushMocks.subscribe).toHaveBeenCalledWith("MOCK-PUBLIC-KEY"),
    );
    expect(
      await screen.findByText("Notifications are on for this device."),
    ).toBeTruthy();
  });

  it("lists devices by label only, and removes one", async () => {
    apiMocks.devices = [
      {
        id: "dev-1",
        device_label: "iPhone",
        created_at: "2026-09-26T10:00:00",
        last_ok_at: null,
        last_error: null,
      },
    ];
    renderSection();
    expect(await screen.findByText("Notifications are on.")).toBeTruthy();
    const row = screen.getByText("iPhone");
    expect(row).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove iPhone" }));
    await waitFor(() => expect(apiMocks.devices).toHaveLength(0));
  });

  it("keeps 'When you're ready' off by default and turns it on with one click", async () => {
    renderSection();
    const whenReady = (await screen.findByLabelText(/When you're ready/)) as HTMLInputElement;
    expect(whenReady.checked).toBe(false);
    // Switches stay dead until the server's own prefs arrive (the
    // defaults must not be clickable guesses).
    await waitFor(() => expect(whenReady.disabled).toBe(false));
    await userEvent.click(whenReady);
    await waitFor(() => expect(apiMocks.prefs.tiers.when_ready).toBe(true));
    await waitFor(() => expect(whenReady.checked).toBe(true));
  });

  it("saves quiet-hours edits and the test button posts to the server", async () => {
    const user = userEvent.setup();
    renderSection();
    const start = (await screen.findByLabelText("From")) as HTMLInputElement;
    await waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.change(start, { target: { value: "22:30" } });
    await waitFor(() => expect(apiMocks.prefs.quiet_hours.start).toBe("22:30"));
    await user.click(screen.getByRole("button", { name: "Send me a test" }));
    const pushApi = await import("../data/api");
    await waitFor(() => expect(pushApi.sendTestNotification).toHaveBeenCalled());
    expect(
      await screen.findByText("Test sent — it should arrive shortly."),
    ).toBeTruthy();
  });
});
