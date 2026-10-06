/**
 * G10 (UI-UX v2 spec §8.3) — state sentinels: each fixture shows its expected headline
 * (§4.4), the right actions (§4.2), and "offline" has a dashed ring and a last-seen time.
 */
import { expect, test, type Page } from "@playwright/test";

const NOW = new Date("2026-10-02T23:10:00+05:30");

async function open(page: Page, fixture: string) {
  await page.clock.setFixedTime(NOW);
  await page.goto(`/app?fixture=${fixture}`);
  await page.getByTestId(fixture === "loading" ? "overview-loading" : "overview-ready").waitFor();
}

type Expectation = {
  headline: RegExp | null;
  actions: string[];           // accessible names that must be visible
  absent?: string[];           // accessible names that must not exist
  extra?: (page: Page) => Promise<void>;
};

const EXPECTATIONS: Record<string, Expectation> = {
  "live-calm": {
    headline: /is calm\. \d+ min left in this session\./,
    actions: ["Add time", "Lock now", "More actions"],
  },
  "live-neutral": {
    headline: /is doing okay\. \d+ min left in this session\./,
    actions: ["Add time", "Lock now", "More actions"],
  },
  "live-stressed": {
    headline: /has had a tense few minutes\. A breather was offered at .+\./,
    actions: ["Lock now", "More actions"],
    absent: ["Add time"],
  },
  "session-ending": {
    headline: /\d+ min left in Aarav's session\./,
    actions: ["Add time", "Lock now", "More actions"],
    extra: async (page) => {
      // ring turns amber under 5 minutes (§4.4)
      const stroke = await page.locator('section[aria-label="Current status"] circle').nth(1).getAttribute("stroke");
      expect(stroke).toBe("var(--neutral)");
    },
  },
  offline: {
    headline: /'s phone hasn't checked in for \d+ min\. Limits still apply\./,
    actions: ["Add time when back online"],
    absent: ["More actions"],
    extra: async (page) => {
      // dashed ring track (§4.5)
      const dash = await page.locator('section[aria-label="Current status"] circle').first().getAttribute("stroke-dasharray");
      expect(dash, "offline ring track is dashed").toBeTruthy();
      // disabled Lock now + one-line reason beneath (§4.2)
      const lock = page.getByRole("button", { name: "Lock now" });
      await expect(lock).toBeDisabled();
      await expect(page.getByText("Locking applies when the phone reconnects", { exact: false })).toBeVisible();
      // offline explainer sentence (§4.5)
      await expect(page.getByText("Limits still work offline", { exact: false })).toBeVisible();
      // last-seen line never shows raw seconds (D8)
      await expect(page.getByText(/Last checked in \d+ min ago/).first()).toBeVisible();
    },
  },
  stale: {
    headline: /hasn't checked in for .+\. Limits still apply\./,
    actions: ["Add time when back online"],
    extra: async (page) => {
      await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    },
  },
  locked: {
    headline: /'s phone is locked\./,
    actions: ["Start session"],
  },
  "no-session": {
    headline: /isn't in a session right now\./,
    actions: ["Start session"],
  },
  empty: {
    headline: null,
    actions: ["Set up your child's phone"],
    extra: async (page) => {
      await expect(page.getByText("No device connected yet")).toBeVisible();
    },
  },
  error: {
    headline: null,
    actions: ["Retry"],
  },
  loading: {
    headline: null,
    actions: [],
    extra: async (page) => {
      await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    },
  },
  "long-strings": {
    headline: null, // headline content varies with the long name; layout gates cover it
    actions: ["Add time", "Lock now", "More actions"],
    extra: async (page) => {
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Bartholomew");
      await expect(page.getByText("12 h 59 min").first()).toBeVisible();
    },
  },
};

for (const [fixture, exp] of Object.entries(EXPECTATIONS)) {
  test(`G10 · ${fixture} shows its state sentence and actions`, async ({ page }) => {
    await open(page, fixture);

    if (exp.headline) {
      await expect(page.getByRole("heading", { level: 1 })).toContainText(exp.headline);
    }
    for (const name of exp.actions) {
      const control = page.getByRole("button", { name }).or(page.getByRole("link", { name }));
      await expect(control.first()).toBeVisible();
    }
    for (const name of exp.absent ?? []) {
      const control = page.getByRole("button", { name }).or(page.getByRole("link", { name }));
      await expect(control).toHaveCount(0);
    }
    await exp.extra?.(page);
  });
}
