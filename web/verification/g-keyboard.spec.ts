/**
 * G5 (UI-UX v2 spec §8.3) — keyboard walk: every interactive element reachable by Tab,
 * a visible focus ring that is not clipped, Esc closes popovers, no traps.
 */
import { expect, test } from "@playwright/test";

test("G5 · keyboard: all interactive elements reachable with visible, unclipped focus (live-neutral)", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
  await page.goto("/?fixture=live-neutral");
  await page.getByTestId("overview-ready").waitFor();

  const expected = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
      })
      .map((el) => {
        const t = (el.textContent || "").trim().slice(0, 20) || el.getAttribute("aria-label") || "";
        return `${el.tagName.toLowerCase()}:${t}`;
      }),
  );

  const visited = new Set<string>();
  const clipped: string[] = [];
  for (let i = 0; i < Math.max(expected.length * 2 + 10, 40); i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const ringVisible = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const inViewport = r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0;
      const t = (el.textContent || "").trim().slice(0, 20) || el.getAttribute("aria-label") || "";
      return {
        k: `${el.tagName.toLowerCase()}:${t}`,
        ringVisible,
        inViewport,
        text: t.slice(0, 24),
      };
    });
    if (info === null) continue; // transient focus loss; keep walking
    visited.add(info.k);
    if (!info.ringVisible) clipped.push(`"${info.text}" has no visible focus ring`);
    if (!info.inViewport) clipped.push(`"${info.text}" focus target is outside the viewport`);
  }

  const missing = expected.filter((k) => !visited.has(k));
  expect(missing, "interactive elements never reached by Tab").toEqual([]);
  expect(clipped, "focus ring visibility/clipping").toEqual([]);
});

test("G5 · keyboard: Esc closes the Add-time popover", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
  await page.goto("/?fixture=live-calm");
  await page.getByTestId("overview-ready").waitFor();

  await page.getByRole("button", { name: "Add time" }).click();
  await expect(page.getByText("Add 10 more minutes?")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Add 10 more minutes?")).toBeHidden();
});
