/** Home verification matrix (spec §12.2/§12.3): H1–H4, H6, H9, H12, H14 across
 *  themes × viewports. Sibling specs cover H5, H7–H11, H13, H15–H18. */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { bannedCopy, findOverlaps, findOverflow, findSmallTargets, findWrappedNoWrap, thirdPartyRequests, typeFloor } from "./home.checks";

const VIEWPORTS = [320, 390, 768, 1024, 1280, 1440, 1920].map((w) => ({ width: w, height: w < 768 ? 844 : 900 }));

for (const theme of ["light", "dark"] as const) {
  for (const vp of VIEWPORTS) {
    test(`home · ${theme} · ${vp.width}`, async ({ page }) => {
      const logs: string[] = [];
      page.on("console", (m) => ["error", "warning"].includes(m.type()) && logs.push(m.text()));
      page.on("pageerror", (e) => logs.push(String(e)));
      const thirdParty = thirdPartyRequests(page, "http://127.0.0.1:4175");

      await page.setViewportSize(vp);
      await page.addInitScript((t) => localStorage.setItem("sh-theme", t), theme);
      await page.goto("/");
      await page.getByTestId("home-ready").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);

      await page.screenshot({
        path: `../verification/home/shots/default-${theme}-${vp.width}.png`,
        fullPage: true,
        animations: "disabled",
      });

      expect.soft(await findOverlaps(page), "H1 overlaps").toEqual([]);
      expect.soft(await findOverflow(page), "H2 overflow/clipping").toEqual([]);
      expect.soft(await findWrappedNoWrap(page), "H3 wrapped nowrap").toEqual([]);
      expect.soft(await findSmallTargets(page, vp.width <= 768 ? 44 : 24), "H12 tap targets").toEqual([]);
      expect.soft(await typeFloor(page), "H14 type floor").toEqual([]);
      expect.soft(bannedCopy(await page.locator("main").innerText()), "H9 copy").toEqual([]);
      expect.soft(logs, "H6 console").toEqual([]);
      expect.soft(thirdParty, "H6 third-party requests").toEqual([]);

      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect.soft(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")), "H4 axe").toEqual([]);
    });
  }
}
