import { expect, test } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, failOnConsoleErrors, login } from "./helpers";

test.describe.configure({ mode: "serial" });

let assertClean: () => void;

test.beforeEach(({ page }) => {
  assertClean = failOnConsoleErrors(page);
});

test("login as the demo parent -> overview shows live status, KPIs and timeline", async ({ page }) => {
  await login(page, DEMO_EMAIL, DEMO_PASSWORD);

  await expect(page.getByRole("heading", { name: "Right now" })).toBeVisible();
  await expect(page.getByLabel("Calm Index", { exact: true })).toBeVisible();
  await expect(page.getByText("Screen time today")).toBeVisible();
  await expect(page.getByText("Calm timeline — today")).toBeVisible();
  await expect(page.getByText("Top apps today")).toBeVisible();
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
