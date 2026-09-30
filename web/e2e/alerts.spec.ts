import { expect, test, type Page } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, failOnConsoleErrors, login } from "./helpers";

const unreadBell = (page: Page) => page.getByRole("link", { name: /unread alerts/ }).first();

test("alerts: unread badge -> open alerts -> mark all read -> badge clears", async ({ page }) => {
  const assertClean = failOnConsoleErrors(page);
  await login(page, DEMO_EMAIL, DEMO_PASSWORD);

  // unread alerts exist in the seeded demo data (mobile header + desktop sidebar bells)
  await expect(unreadBell(page)).toBeVisible();

  await unreadBell(page).click();
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  await expect(page.getByText("New").first()).toBeVisible();

  await page.getByRole("button", { name: /Mark all read/ }).click();
  await expect(page.getByRole("link", { name: "Alerts" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /unread alerts/ })).toHaveCount(0);

  assertClean();
});

test("axe: no critical or serious violations on alerts", async ({ page }) => {
  await login(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto("/alerts");
  const axeBuilder = await import("@axe-core/playwright").then((module) => new module.AxeBuilder({ page }));
  const results = await axeBuilder.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(serious).toEqual([]);
});
