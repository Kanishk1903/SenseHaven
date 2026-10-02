/**
 * v2 propagation matrix (UI-UX v2 spec §6.4): every parent-dashboard screen runs the
 * same G-checks in both themes at 320 / 768 / 1440, using the fixture harness for data.
 */
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { findOverlaps, findOverflow, findWrappedNoWrap, findSmallTargets, copyLint, findTypeFloorViolations } from "./checks";

const CHILD = "f0ce-0001"; // fixture child id (web/src/lib/fixture.ts)
const ROUTES = [
  { name: "alerts", path: "/alerts" },
  { name: "analytics", path: `/children/${CHILD}/analytics` },
  { name: "settings", path: `/children/${CHILD}/settings` },
  { name: "download", path: "/download" },
  { name: "account", path: "/account" },
  { name: "login", path: "/login", bare: true },
];
const VIEWPORTS = [320, 768, 1440].map((w) => ({ width: w, height: w < 768 ? 844 : 900 }));
const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route.name} · ${theme} · ${vp.width}`, async ({ page }) => {
        const logs: string[] = [];
        page.on("console", (m) => {
          if (!["error", "warning"].includes(m.type())) return;
          // the /login route runs without fixtures: its auth probe 500s against the
          // API-less preview server (harness artifact, not a page defect)
          if (m.location()?.url?.includes("/api/")) return;
          logs.push(m.text());
        });
        page.on("pageerror", (e) => logs.push(String(e)));
        await page.setViewportSize(vp);
        await page.clock.setFixedTime(new Date("2026-10-02T23:10:00+05:30"));
        await page.addInitScript((t) => localStorage.setItem("sh-theme", t), theme);
        await page.goto(`${route.bare ? route.path : route.path + "?fixture=live-neutral"}`);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(400);

        await page.screenshot({
          path: `../verification/shots/page-${route.name}-${theme}-${vp.width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);

        expect.soft(await findOverlaps(page), "G1 overlaps").toEqual([]);
        expect.soft(await findOverflow(page), "G2 overflow/clipping").toEqual([]);
        expect.soft(await findWrappedNoWrap(page), "G3 wrapped nowrap").toEqual([]);
        expect.soft(await findSmallTargets(page, vp.width <= 768 ? 44 : 24), "G12 tap targets").toEqual([]);
        expect.soft(await findTypeFloorViolations(page), "G14 type floor").toEqual([]);

        const root = page.locator("main").first();
        expect.soft(copyLint(await root.innerText().catch(() => "")), "G9 copy lint").toEqual([]);

        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect.soft(
          axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
          "G4 axe serious/critical",
        ).toEqual([]);

        expect.soft(logs, "G6 console errors/warnings").toEqual([]);
      });
    }
  }
}
