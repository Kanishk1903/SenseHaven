import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

import { DEMO_EMAIL, DEMO_PASSWORD, login, uniqueEmail } from "./helpers";

const OUT = "../verification/screenshots/web";
const WIDTHS = [390, 1440];

test("capture UI screenshots at 390px and 1440px", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });

  // 1) onboarding — reach the PIN step so the shot shows the wizard with real content
  const email = uniqueEmail();
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Shots Parent");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill("e2e-password-123");
  await page.getByRole("button", { name: /Create account/ }).click();
  await expect(page.getByRole("heading", { name: "Set up SenseHeaven" })).toBeVisible();
  await page.getByLabel("Child's name").fill("Shots Kid");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Set your device PIN")).toBeVisible();

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/onboarding-${width}.png`, fullPage: true });
  }

  // 2) authenticated pages as the demo parent (drop the fresh session first)
  await page.context().clearCookies();
  await login(page, DEMO_EMAIL, DEMO_PASSWORD);
  const childrenResponse = await page.request.get("/api/v1/children");
  const kids = (await childrenResponse.json()) as { id: string }[];
  expect(kids.length).toBeGreaterThan(0);
  const childId = kids[0].id;

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/overview-${width}.png`, fullPage: true });

    await page.goto(`/children/${childId}/analytics`);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/analytics-emotion-${width}.png`, fullPage: true });

    await page.goto("/alerts");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/alerts-${width}.png`, fullPage: true });

    await page.goto(`/children/${childId}/settings`);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/settings-${width}.png`, fullPage: true });
  }

  expect(mkdirSync(OUT, { recursive: true })).toBeUndefined();
});
