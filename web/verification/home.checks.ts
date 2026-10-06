/** Home verification helpers (spec §12.3) — built on the v2 checks; adds the
 *  marketing-specific gates: third-party requests, type floor with caps check,
 *  banned copy, CONFIRM guard, no-JS sentinels. */
import type { Page } from "@playwright/test";

export const findOverlaps = (page: Page) => import("./checks").then((m) => m.findOverlaps(page));
export const findOverflow = (page: Page) => import("./checks").then((m) => m.findOverflow(page));
export const findWrappedNoWrap = (page: Page) => import("./checks").then((m) => m.findWrappedNoWrap(page));
export const findSmallTargets = (page: Page, min: number) => import("./checks").then((m) => m.findSmallTargets(page, min));

/** H6 — zero third-party requests (a privacy product does not phone home). */
export const thirdPartyRequests = (page: Page, origin: string) => {
  const bad: string[] = [];
  page.on("request", (r) => {
    try {
      if (new URL(r.url()).origin !== origin && !r.url().startsWith("data:")) bad.push(r.url());
    } catch {
      /* opaque URLs ignored */
    }
  });
  return bad;
};

/** H14 — type floor: ≥12px, tracking ≥ −0.02em, no ALL-CAPS transform. */
export const typeFloor = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!hasText) return;
      const cs = getComputedStyle(el);
      const px = parseFloat(cs.fontSize);
      const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing);
      const tag = `<${el.tagName.toLowerCase()}> "${(el.textContent || "").trim().slice(0, 24)}"`;
      if (px < 12) out.push(`${tag} font-size ${px}px`);
      if (px && ls / px < -0.0201) out.push(`${tag} tracking ${(ls / px).toFixed(3)}em`);
      if (cs.textTransform === "uppercase") out.push(`${tag} uppercase`);
    });
    return out;
  });

/** H9 — banned copy (spec §2/§6). */
export const bannedCopy = (text: string) => {
  const rules: [RegExp, string][] = [
    [/\[CONFIRM/i, "unresolved CONFIRM marker"],
    [/lorem|TODO|undefined|NaN|\[object/i, "placeholder or leaked value"],
    [/!/, "exclamation mark"],
    [/\p{Extended_Pictographic}/u, "emoji"],
    [/\b(revolutionary|seamless(ly)?|unlock|empower(s|ing)?|supercharge|cutting-edge|game-changing|peace of mind|journey)\b/i, "banned word"],
  ];
  return rules.filter(([re]) => re.test(text)).map(([, why]) => why);
};

/** H15 — content that must exist with JavaScript disabled. */
export const noJsSentinels = async (page: Page) => {
  const heading = await page.locator("h1").count();
  const cta = await page.getByRole("link", { name: /get the app/i }).count();
  const faq = await page.locator("details").count();
  const panel = await page.locator("section[aria-label='Current status']").count();
  return { heading, cta, faq, panel };
};
