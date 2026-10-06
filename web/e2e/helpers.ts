import { expect, type Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@senseheaven.app";
export const DEMO_PASSWORD = "demo-password-123";

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

/** Fail the test on ANY console error or page error (gate-4 bar: 0 console/page errors). */
export function failOnConsoleErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The pre-login /auth/me probe returns 401 by design (session detection) — the browser
    // logs every failed fetch, so filter that one expected case.
    if (message.location()?.url?.includes("/api/v1/auth/me") && message.text().includes("401")) return;
    consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  return () => {
    expect(pageErrors, "uncaught page errors").toEqual([]);
    expect(consoleErrors, "console errors").toEqual([]);
  };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  // the redesigned overview greets "Hi {name}'s parent" — anchor on the nav link instead
  await expect(page.getByRole("link", { name: "Overview" }).first()).toBeVisible({ timeout: 15_000 });
}
