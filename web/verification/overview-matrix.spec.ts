/**
 * v2 verification matrix (UI-UX v2 spec §8.2/§8.3):
 * themes {light,dark} × viewports {320,390,768,1024,1280,1440,1920} × 12 fixtures.
 * Gates on this spec: G1 overlaps, G2 overflow, G3 nowrap, G4 axe, G6 console,
 * G9 copy, G12 tap targets, G14 type floor. Screenshots → verification/shots/.
 */
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { findOverlaps, findOverflow, findWrappedNoWrap, findSmallTargets, copyLint, findUppercaseLabels, findTypeFloorViolations } from "./checks";

const FIXTURES = [
  "live-calm", "live-neutral", "live-stressed", "session-ending", "offline", "stale",
  "locked", "no-session", "loading", "empty", "error", "long-strings",
] as const;
const VIEWPORTS = [320, 390, 768, 1024, 1280, 1440, 1920].map((w) => ({ width: w, height: w < 768 ? 844 : 900 }));
const THEMES = ["light", "dark"] as const;

async function openFixture(page: Page, fixture: string, theme: string, vp: { width: number; height: number }) {
  const logs: string[] = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) logs.push(m.text());
  });
  page.on("pageerror", (e) => logs.push(String(e)));
  await page.setViewportSize(vp);
  await page.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
  await page.addInitScript((t) => localStorage.setItem("sh-theme", t), theme);
  await page.goto(`/?fixture=${fixture}`);
  await page.getByTestId(fixture === "loading" ? "overview-loading" : "overview-ready").waitFor();
  return logs;
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    for (const fx of FIXTURES) {
      test(`overview · ${fx} · ${theme} · ${vp.width}`, async ({ page }) => {
        const logs = await openFixture(page, fx, theme, vp);

        await page.screenshot({
          path: `../verification/shots/${fx}-${theme}-${vp.width}.png`,
          fullPage: true,
          animations: "disabled",
        });

        // canonical scroll state: full-page capture can leave the window scrolled
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);

        expect.soft(await findOverlaps(page), "G1 overlaps").toEqual([]);
        expect.soft(await findOverflow(page), "G2 overflow/clipping").toEqual([]);
        expect.soft(await findWrappedNoWrap(page), "G3 wrapped nowrap").toEqual([]);
        expect.soft(await findSmallTargets(page, vp.width <= 768 ? 44 : 24), "G12 tap targets").toEqual([]);
        const pageRoot = page.getByTestId(fx === "loading" ? "overview-loading" : "overview-ready");
        expect.soft(copyLint(await pageRoot.innerText()), "G9 copy lint").toEqual([]);
        expect.soft(await findUppercaseLabels(page), "G9 uppercase labels").toEqual([]);
        expect.soft(logs, "G6 console errors/warnings").toEqual([]);

        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect.soft(
          axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
          "G4 axe serious/critical",
        ).toEqual([]);

        expect.soft(await findTypeFloorViolations(page), "G14 type floor").toEqual([]);
      });
    }
  }
}
