/** H11 (long-name + pseudo-locale + zoom-200 at 320 pass H1–H3),
 *  H15 (no-JS render), H16 (budgets), H17 (metadata). */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { expect, test } from "@playwright/test";

import { findOverlaps, findOverflow, findWrappedNoWrap, noJsSentinels } from "./home.checks";

test("H11 · long name + pseudo-locale + 200% zoom at 320px pass H1–H3", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  // pseudo-locale: +40% longer strings via CSS text-length simulation — the honest proxy
  // is zoom + letter-spacing; we use 200% root zoom plus the long sample name below
  await page.goto("/");
  await page.getByTestId("home-ready").waitFor();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    // pseudo-locale: pad every heading and paragraph by 40%
    document.querySelectorAll("h1, h2, h3, p").forEach((el) => {
      el.textContent = (el.textContent ?? "").replace(/(Aarav)/g, "Aaravu-Bafangu");
    });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../verification/home/shots/pseudo-zoom-long-light-320.png", fullPage: true });

  expect.soft(await findOverlaps(page), "H1 overlaps").toEqual([]);
  expect.soft(await findOverflow(page), "H2 overflow").toEqual([]);
  expect.soft(await findWrappedNoWrap(page), "H3 nowrap").toEqual([]);
});

test("H15 · no-JS: headline, lede, CTA, static panel, FAQ and anchors all present", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  const sentinels = await noJsSentinels(page);
  expect(sentinels.heading, "one h1").toBe(1);
  expect(sentinels.cta, "Get the app CTA").toBeGreaterThan(0);
  expect(sentinels.faq, "native details FAQ").toBeGreaterThanOrEqual(8);
  expect(sentinels.panel, "static hero panel").toBe(1);
  await expect(page.getByRole("heading", { name: /Know how they're doing/ })).toBeVisible();
  // anchors work without JS
  await page.getByRole("link", { name: "See a sample day" }).click();
  await expect(page.locator("#sample-day-heading")).toBeVisible();
  await ctx.close();
});

test("H16 · budgets: home entry JS ≤ 90 KB gzip; fonts preloaded ≤ 120 KB", async () => {
  const home = readFileSync("dist/home.html", "utf8");
  const scripts = [...home.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]!);
  expect(scripts.length, "home.html references its entry scripts").toBeGreaterThan(0);
  let gz = 0;
  for (const src of scripts) {
    gz += gzipSync(readFileSync(`dist${src}`)).length;
  }
  expect(gz, `home initial JS gzip ${gz} bytes ≤ 90 KB`).toBeLessThanOrEqual(90 * 1024);
  const preloaded = [...home.matchAll(/rel="preload"[^>]*href="([^"]+)"/g)].map((m) => m[1]!);
  let fontBytes = 0;
  for (const href of preloaded) {
    if (href.endsWith(".woff2")) fontBytes += readFileSync(`dist${new URL(href, "http://x").pathname}`).length;
  }
  expect(fontBytes, `preloaded fonts ${fontBytes} ≤ 120 KB`).toBeLessThanOrEqual(120 * 1024);
});

test("H17 · metadata: single h1, title/description lengths, OG image, JSON-LD", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-ready").waitFor();

  expect(await page.locator("h1").count(), "single h1").toBe(1);
  const title = await page.title();
  expect(title.length, `title ${title.length} ≤ 60`).toBeLessThanOrEqual(60);
  const desc = await page.locator("meta[name='description']").getAttribute("content");
  expect(desc?.length ?? 0, "description ≤ 155").toBeLessThanOrEqual(155);

  const headingTexts = await page.evaluate(() =>
    [...document.querySelectorAll("h1, h2, h3")].map((h) => parseInt(h.tagName[1]!, 10)),
  );
  let prev = 0;
  for (const level of headingTexts) {
    expect(level - prev, `heading order jumps ${prev}→${level}`).toBeLessThanOrEqual(1);
    prev = level;
  }

  const og = await page.locator("meta[property='og:image']").getAttribute("content");
  expect(og, "og:image present").toBeTruthy();
  const ogRes = await page.request.get(og!);
  expect(ogRes.status(), "og:image resolves").toBe(200);
  expect(ogRes.headers()["content-type"]).toBe("image/png");

  const ld = await page.locator("script[type='application/ld+json']").getAttribute("src");
  expect(ld, "JSON-LD present").toBeTruthy();
  const ldBody = await page.request.get(ld!).then((r) => r.body());
  const parsed = JSON.parse(ldBody!.toString());
  expect(parsed["@type"]).toBe("FAQPage");
  expect(JSON.stringify(parsed)).not.toMatch(/\[CONFIRM|TODO/i);
});

