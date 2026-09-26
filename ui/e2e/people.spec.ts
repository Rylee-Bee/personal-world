/**
 * People (board "People · household and roles"): roles in plain words,
 * changing a role behind "Confirm it's you", and handing the World over.
 * Made-up people only (Sam, Jo, Alex, Robin, Kit).
 */
import { test, expect } from "./test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  await request.delete("/api/__test/reset");
});

async function openPeople(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "World navigation" }).getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Open people" }).click();
  return page.getByRole("main", { name: "People" });
}

test("lists everyone by what they can do, passes axe, and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const main = await openPeople(page);
  await expect(main.getByRole("heading", { level: 1, name: "People in this World" })).toBeVisible();
  await expect(main.getByText("Runs this World", { exact: true })).toBeVisible();
  await expect(main.getByText("Helps run this World", { exact: true })).toBeVisible();
  await expect(main.getByText("Has their own space, with limits", { exact: true })).toBeVisible();
  // Nobody changes the owner's role or their own here.
  await expect(main.getByRole("button", { name: "Change what Sam can do" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Change what Alex can do" })).toBeVisible();
  // Role ids never appear on screen.
  await expect(main.getByText(/\b(supervised|guest|admin)\b/)).toHaveCount(0);

  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("changing a role asks to confirm it's you, then saves", async ({ page }) => {
  const main = await openPeople(page);
  await main.getByRole("button", { name: "Change what Alex can do" }).click();
  const group = main.getByRole("group", { name: "Change what Alex can do" });
  await group.getByRole("radio", { name: /Helps run this World/ }).check();
  await group.getByRole("button", { name: "Save for Alex" }).click();

  const key = group.getByLabel("Your sign-in key");
  await expect(key).toBeFocused();
  await key.fill("made-up-key");
  await group.getByRole("button", { name: "Confirm", exact: true }).click();

  await expect(main.getByRole("status").filter({ hasText: "Saved. Alex: Helps run this World." })).toBeVisible();
  await expect(main.getByRole("button", { name: "Change what Alex can do" })).toBeFocused();
});

test("handing the World over needs the name typed exactly", async ({ page }) => {
  const main = await openPeople(page);
  const section = main.getByRole("region", { name: "Hand this World over" });
  const handOver = section.getByRole("button", { name: "Hand over to Jo" });
  await expect(handOver).toBeDisabled();
  await section.getByLabel("Type Jo’s name to confirm").fill("jo");
  await expect(handOver).toBeDisabled();
  await section.getByLabel("Type Jo’s name to confirm").fill("Jo");
  await handOver.click();
  await section.getByLabel("Your sign-in key").fill("made-up-key");
  await section.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(main.getByRole("status").filter({ hasText: "Jo now runs this World." })).toBeVisible();
});

test("with SSO, Confirm with your sign-in goes out and comes back to the same page", async ({ page }) => {
  await page.route("**/api/auth/session", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data = { ...body.data, step_up_methods: ["sso"] };
    await route.fulfill({ response, json: body });
  });
  let wentOut = "";
  await page.route("**/api/auth/oidc/step-up**", async (route) => {
    wentOut = route.request().url();
    // The provider signs the person in again and sends them back.
    await route.fulfill({ status: 302, headers: { location: "/" } });
  });

  const main = await openPeople(page);
  await main.getByRole("button", { name: "Change what Alex can do" }).click();
  const group = main.getByRole("group", { name: "Change what Alex can do" });
  await group.getByRole("radio", { name: /Helps run this World/ }).check();
  await group.getByRole("button", { name: "Save for Alex" }).click();

  await expect(group.getByText("Confirm it’s you")).toBeFocused();
  await expect(group.getByLabel("Your sign-in key")).toHaveCount(0);
  await group.getByRole("button", { name: "Confirm with your sign-in" }).click();

  await expect(page.getByRole("main", { name: "People" })).toBeVisible();
  expect(new URL(wentOut).searchParams.get("return_to")).toBe("/");
  await expect(page.getByRole("status").filter({ hasText: "You’re confirmed for the next few minutes." })).toBeVisible();
});
