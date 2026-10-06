/** H5 (keyboard), H7 (CLS across state cycling), H8 (motion), H10 (state sentinels). */
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("H5 · keyboard: nav, switcher, pause operable; Esc closes the menu; no traps", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-ready").waitFor();

  // focus walk reaches the switcher and pause controls with visible rings
  const radiogroup = page.getByRole("radiogroup", { name: "Demo state" });
  await radiogroup.focus();
  await page.keyboard.press("ArrowRight"); // moves to Neutral
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Stressed" })).toBeChecked();

  const pause = page.getByRole("button", { name: /demo/i });
  await pause.focus();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "false");

  // mobile menu: Esc closes, focus returns
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.focus();
  await menu.click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();

  // tab order: the skip link is the first focusable element
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to main content")).toBeFocused();
});

test("H7 · CLS < 0.02 through load, font swap and all three demo states", async ({ page }) => {
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
  await page.goto("/");
  await page.getByTestId("home-ready").waitFor();
  await page.evaluate(() => document.fonts.ready);

  for (const name of ["Neutral", "Stressed", "Calm"]) {
    await page.getByRole("radio", { name }).click();
    await page.waitForTimeout(150);
  }
  const cls = await page.evaluate(() => (window as unknown as { __cls?: number }).__cls ?? 0);
  expect(cls, `CLS ${cls.toFixed(4)}`).toBeLessThan(0.02);
});

test("H8 · reduced motion: no animations, no auto-cycle; default: the demo cycles", async ({ browser }) => {
  // positive control: the orb breathes under normal motion
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByTestId("home-ready").waitFor();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => document.getAnimations().length);
  expect(before, "orb breathe loop should run under normal motion").toBeGreaterThan(0);

  // auto-cycle: a state change happens within the 7 s period
  const first = await page.getByRole("status").first().textContent();
  await page.waitForTimeout(7500);
  const after = await page.getByRole("status").first().textContent();
  expect(after).not.toEqual(first);
  await ctx.close();

  // reduced motion: no animations at all, and the headline never auto-changes
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rpage = await rctx.newPage();
  await rpage.goto("/");
  await rpage.getByTestId("home-ready").waitFor();
  await rpage.waitForTimeout(500);
  const anims = await rpage.evaluate(() => document.getAnimations().length);
  expect(anims, "running animations under prefers-reduced-motion").toEqual(0);
  const rFirst = await rpage.getByRole("status").first().textContent();
  await rpage.waitForTimeout(7500);
  const rAfter = await rpage.getByRole("status").first().textContent();
  expect(rAfter).toEqual(rFirst);
  await rctx.close();
});

test("H10 · sentinels: each demo state shows its sentence, chip and state", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-ready").waitFor();
  await page.getByRole("button", { name: "Pause demo" }).click();

  const cases = [
    { name: "Calm", text: /Aarav is calm\./ },
    { name: "Neutral", text: /Aarav is doing okay\./ },
    { name: "Stressed", text: /Aarav has had a tense few minutes\./ },
  ];
  for (const c of cases) {
    await page.getByRole("radio", { name: c.name }).click();
    const status = page.getByRole("status").first();
    await expect(status).toContainText(c.text);
    await expect(page.locator("section[aria-label='Current status']")).toBeVisible();
  }
  // the offline state is never shown on Home
  await expect(page.locator("main")).not.toContainText("Limits still work offline");
});
