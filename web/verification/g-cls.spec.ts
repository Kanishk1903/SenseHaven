/**
 * G7 (UI-UX v2 spec §8.3) — CLS < 0.05 including after a simulated poll refresh
 * (window.__shRefetch, installed by the fixture harness).
 */
import { expect, test } from "@playwright/test";

test("G7 · layout stays stable through a simulated poll refresh", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls?: number }).__cls = 0;
    new PerformanceObserver((list) => {
      let total = (window as unknown as { __cls?: number }).__cls ?? 0;
      for (const entry of list.getEntries()) {
        const e = entry as LayoutShift & { hadRecentInput?: boolean };
        if (!e.hadRecentInput) total += e.value;
      }
      (window as unknown as { __cls?: number }).__cls = total;
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
  await page.goto("/?fixture=live-neutral");
  await page.getByTestId("overview-ready").waitFor();
  await page.waitForTimeout(800);

  // simulated poll refresh: invalidate every query, let the UI re-render
  await page.evaluate(() => (window as unknown as { __shRefetch?: () => void }).__shRefetch?.());
  await page.waitForTimeout(2_000);

  const cls = await page.evaluate(() => (window as unknown as { __cls?: number }).__cls ?? 0);
  expect(cls, `CLS ${cls.toFixed(4)} must stay below 0.05`).toBeLessThan(0.05);
});
