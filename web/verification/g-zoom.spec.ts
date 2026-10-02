/**
 * G11 (UI-UX v2 spec §8.3) — long-strings fixture + 200% text zoom + 320px must pass
 * G1–G3. Type tokens are rem-based so root font-size zoom scales the whole scale.
 */
import { expect, test } from "@playwright/test";

import { findOverlaps, findOverflow, findWrappedNoWrap } from "./checks";

test("G11 · long-strings at 320px with 200% text zoom passes G1–G3", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
  await page.goto("/?fixture=long-strings");
  await page.getByTestId("overview-ready").waitFor();

  // 200% text zoom (spec §8.2)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.waitForTimeout(400);

  await page.screenshot({ path: "../verification/shots/long-strings-light-320-zoom200.png", fullPage: true });

  expect.soft(await findOverlaps(page), "G1 overlaps at 200% zoom").toEqual([]);
  expect.soft(await findOverflow(page), "G2 overflow at 200% zoom").toEqual([]);
  expect.soft(await findWrappedNoWrap(page), "G3 wrapped nowrap at 200% zoom").toEqual([]);
});
