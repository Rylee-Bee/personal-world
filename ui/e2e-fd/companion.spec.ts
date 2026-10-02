import { expect, test } from "@playwright/test";
import { createCompanionServer } from "../src/fd/companion-server";
import { axe, noHorizontalOverflow, open } from "./helpers";

const SHOTS = process.env.PW_FD_SHOTS;

test("the Companion button is a quiet control in the header, and the landmarks do not change", async ({ page }) => {
  await open(page);
  const nav = await page.getByRole("navigation", { name: "Main" }).getByRole("link").allTextContents();
  expect(nav).toEqual(["Home", "Connect", "Memory", "Settings"]);
  const btn = page.getByRole("button", { name: /^Companion/ });
  await expect(btn).toBeVisible();
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.getByRole("button", { name: /^Companion/ }).count()).toBe(1);
});

test("the open panel: axe clean, no overflow, a modal that traps focus, Escape closes and returns focus", async ({ page }, info) => {
  await open(page);
  const btn = page.getByRole("button", { name: /^Companion/ });
  await btn.click();
  const dialog = page.getByRole("dialog", { name: "Companion" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Companion is up. Not answering: ph.")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await noHorizontalOverflow(page);
  // desktop: a side panel; phone: a full-height sheet
  const box = (await dialog.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.round(box.height)).toBe(vp.height);
  if (info.project.name.includes("phone")) expect(Math.round(box.width)).toBe(vp.width);
  else expect(box.width).toBeLessThanOrEqual(480 + 1);
  // focus stays inside however many times Tab is pressed
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog") || document.activeElement === document.body)).toBe(true);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-companion-open.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0).catch(() => undefined);
  await expect(page.getByRole("dialog", { name: "Companion" })).toBeHidden();
  await expect(btn).toBeFocused();
});

test("a conversation: thinking, the reply, what was withheld, and axe with replies showing", async ({ page }, info) => {
  await open(page);
  await page.getByRole("button", { name: /^Companion/ }).click();
  const dialog = page.getByRole("dialog", { name: "Companion" });
  await dialog.getByLabel("Message to Companion").fill("hello there");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText(/Here is a short answer to: hello there/)).toBeVisible();
  await expect(dialog.getByText("Some things were withheld: recall: withheld (tier)")).toBeVisible();
  await expect(dialog.getByText("Here with you")).toBeVisible();
  await dialog.getByText("What Companion sees").click();
  await expect(dialog.getByText("Reviewed 1 · Working 0 · Recall 0 · Live 1")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await noHorizontalOverflow(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-companion-thread.png` });
});

test("Companion down: an honest unknown, the message kept, axe clean", async ({ page }, info) => {
  const server = createCompanionServer();
  server.setMode("down");
  await open(page, "#home", "mixed", server);
  await page.getByRole("button", { name: /^Companion/ }).click();
  const dialog = page.getByRole("dialog", { name: "Companion" });
  await dialog.getByLabel("Message to Companion").fill("are you there");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(dialog.getByText("are you there")).toBeVisible();
  await expect(dialog.getByText(/short answer/)).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-companion-down.png` });
});

test("Station on: the panel and the landmarks are identical", async ({ page }) => {
  await open(page, "#settings");
  await page.getByRole("group", { name: "Experience pack" }).getByLabel("Station").check();
  const snap = async () => ({
    nav: await page.getByRole("navigation", { name: "Main" }).getByRole("link").allTextContents(),
    companion: await page.getByRole("button", { name: /^Companion/ }).count(),
  });
  const on = await snap();
  await page.getByRole("group", { name: "Experience pack" }).getByLabel("None").check();
  expect(await snap()).toEqual(on);
});
