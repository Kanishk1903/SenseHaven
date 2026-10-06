/**
 * G8 (UI-UX v2 spec §8.3) — under reduced motion no running animations after settle.
 * Also captures the §8.2 extra evidence: reduced-motion + forced-colours screenshots.
 */
import { expect, test } from "@playwright/test";

const MEDIA = [
  { name: "reduced-motion", options: { reducedMotion: "reduce" as const } },
  { name: "forced-colors", options: { forcedColors: "active" as const } },
];

for (const media of MEDIA) {
  test(`G8 · ${media.name}: no running animations after settle + evidence shots`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...media.options,
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
    await page.goto("/app?fixture=live-calm");
    await page.getByTestId("overview-ready").waitFor();
    await page.waitForTimeout(1_000);

    if (media.name === "reduced-motion") {
      // positive control first: the calm orb genuinely breathes under normal motion
      const normal = await context.browser().newContext({ viewport: { width: 1440, height: 900 } });
      const np = await normal.newPage();
      await np.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
      await np.goto("/app?fixture=live-calm");
      await np.getByTestId("overview-ready").waitFor();
      await np.waitForTimeout(500);
      const running = await np.evaluate(() => document.getAnimations().length);
      await normal.close();
      expect(running, "orb breathe loop should run under normal motion").toBeGreaterThan(0);

      const animations = await page.evaluate(() => document.getAnimations().map((a) => a.constructor.name));
      expect(animations, "running animations under prefers-reduced-motion").toEqual([]);
    }

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((t) => localStorage.setItem("sh-theme", t), theme);
      await page.goto("/app?fixture=live-calm");
      await page.getByTestId("overview-ready").waitFor();
      await page.screenshot({ path: `../verification/shots/live-calm-${theme}-${media.name}-1440.png`, fullPage: true });
      await page.goto("/app?fixture=offline");
      await page.getByTestId("overview-ready").waitFor();
      await page.screenshot({ path: `../verification/shots/offline-${theme}-${media.name}-1440.png`, fullPage: true });
    }

    await context.close();
  });
}
