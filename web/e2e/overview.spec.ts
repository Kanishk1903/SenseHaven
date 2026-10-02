import { expect, test } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, failOnConsoleErrors, login } from "./helpers";

test.describe.configure({ mode: "serial" });

let assertClean: () => void;

test.beforeEach(({ page }) => {
  assertClean = failOnConsoleErrors(page);
});

test("login as the demo parent -> overview shows status sentence, ledger and ribbon", async ({ page }) => {
  await login(page, DEMO_EMAIL, DEMO_PASSWORD);

  await expect(page.getByTestId("overview-ready")).toBeVisible();

  // v2: the h1 is a status sentence naming the child, not a greeting
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Aarav");

  // Now panel: ring timer with the calm estimate beside it
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("estimated from facial expressions")).toBeVisible();

  // Today ledger, day ribbon and top apps sections
  await expect(page.getByRole("region", { name: "Today in numbers" })).toBeVisible();
  await expect(page.getByText("Screen time", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Calm Index ribbon for today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top apps today" })).toBeVisible();
  assertClean();
});

test("axe: no critical or serious violations on overview", async ({ page }) => {
  await login(page, DEMO_EMAIL, DEMO_PASSWORD);
  // axe is injected via @axe-core/playwright
  const axeBuilder = await import("@axe-core/playwright").then((module) => new module.AxeBuilder({ page }));
  const results = await axeBuilder.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(serious).toEqual([]);
});
