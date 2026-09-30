import { expect, test } from "@playwright/test";

import { failOnConsoleErrors, uniqueEmail } from "./helpers";

test("register -> onboarding wizard shows a 6-digit pairing code", async ({ page }) => {
  const assertClean = failOnConsoleErrors(page);
  const email = uniqueEmail();

  await page.goto("/register");
  await page.getByLabel("Your name").fill("E2E Parent");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill("e2e-password-123");
  await page.getByRole("button", { name: /Create account/ }).click();

  // Step 1: add the child
  await expect(page.getByRole("heading", { name: "Set up SenseHeaven" })).toBeVisible();
  await page.getByLabel("Child's name").fill("E2E Kid");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: device PIN (twice)
  await expect(page.getByText("Set your device PIN")).toBeVisible();
  for (const digit of ["1", "2", "3", "4", "5", "6"]) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await expect(page.getByText(/enter it again/i)).toBeVisible();
  for (const digit of ["1", "2", "3", "4", "5", "6"]) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByLabel(/Your account password/).fill("e2e-password-123");
  await page.getByRole("button", { name: /Save PIN/ }).click();

  // Step 3: pairing code appears with a 10-minute countdown
  await expect(page.getByText(/Enter this code in the SenseHeaven app/)).toBeVisible({ timeout: 15_000 });
  const code = await page.getByLabel(/Pairing code/).textContent();
  expect(code).toMatch(/^\d{6}$/);

  // the code must really work via the API: pair a device with it
  const pairResponse = await page.request.post("/api/v1/device/pair", {
    data: { code, device_name: "E2E Phone", android_version: "14", app_version: "1.0.0" },
  });
  expect(pairResponse.status()).toBe(201);
  const paired = (await pairResponse.json()) as { child: { name: string }; config: Record<string, unknown> };
  expect(paired.child.name).toBe("E2E Kid");
  expect(paired.config.config_version).toBe(1);

  assertClean();
});
