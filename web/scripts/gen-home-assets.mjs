/** Generates the marketing images from the real brand artwork (spec §9.2 — no stock art):
 *  public/og.png (1200×630 social card), public/apple-touch-icon.png (180),
 *  public/icon-512.png (maskable, full-bleed). Run: npm run og */
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const ICON_DEFS = `
  <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0ABFC"/><stop offset="0.5" stop-color="#6366F1"/><stop offset="1" stop-color="#22D3EE"/></linearGradient>
  <radialGradient id="lens" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#312E81"/><stop offset="1" stop-color="#050510"/></radialGradient>
  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDA4AF"/><stop offset="1" stop-color="#F43F5E"/></linearGradient>`;
const ICON_ART = (scale, cx, cy) => `
  <circle cx="${cx}" cy="${cy}" r="${25 * scale}" fill="url(#rg)"/>
  <circle cx="${cx}" cy="${cy}" r="${21 * scale}" fill="#0B0B18"/>
  <circle cx="${cx}" cy="${cy}" r="${18 * scale}" fill="url(#lens)"/>
  <g transform="translate(${cx - 32 * scale} ${cy - 32 * scale}) scale(${scale})">
    <path d="M32 43.5 C22 36.5 24.6 27.6 29.4 29.1 C31 29.6 32 31.4 32 31.4 C32 31.4 33 29.6 34.6 29.1 C39.4 27.6 42 36.5 32 43.5 Z" fill="url(#hg)" transform="translate(32 32) translate(-32 -32) translate(0 -2.2)"/>
  </g>
  <path d="M ${cx - 12.5 * scale} ${cy - 6 * scale} A ${14 * scale} ${14 * scale} 0 0 1 ${cx - 4 * scale} ${cy - 13.5 * scale}" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="${2.4 * scale}" stroke-linecap="round"/>`;

const browser = await chromium.launch();

// ── OG 1200×630: headline on paper + the mark + wordmark ─────────────────────
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(`<!doctype html><html><head><style>
  * { margin: 0; }
  body { width: 1200px; height: 630px; background: #F3F0E9; color: #1A1916;
         font-family: "Instrument Sans", system-ui, sans-serif; display: flex; }
  .left { padding: 72px; display: flex; flex-direction: column; justify-content: center; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 500;
       font-size: 72px; line-height: 1.06; letter-spacing: -0.02em; max-width: 15ch; }
  p { margin-top: 24px; font-size: 24px; line-height: 1.4; color: #5B574D; max-width: 40ch; }
  .brand { position: absolute; top: 56px; left: 72px; display: flex; align-items: center; gap: 14px;
           font-family: Georgia, serif; font-weight: 600; font-size: 30px; }
</style></head><body>
  <div class="left">
    <div class="brand">
      <svg width="44" height="44" viewBox="0 0 64 64"><defs>${ICON_DEFS}</defs><rect width="64" height="64" rx="14.5" fill="#07070F"/>${ICON_ART(1, 32, 32)}</svg>
      SenseHeaven
    </div>
    <h1 style="margin-top: 40px;">Know how they're doing, not just how long.</h1>
    <p>Screen time with a calm read: how long, how they seem to be feeling, and what to do next.</p>
  </div>
</body></html>`, { waitUntil: "networkidle" });
await og.screenshot({ path: "public/og.png" });

// ── apple-touch 180 + maskable 512: full-bleed squares (no rounded clip) ─────
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(`<!doctype html><body style="margin:0"><svg width="512" height="512" viewBox="0 0 64 64"><defs>${ICON_DEFS}</defs><rect width="64" height="64" fill="#07070F"/>${ICON_ART(0.82, 32, 32)}</svg></body>`);
await page.screenshot({ path: "public/icon-512.png" });

const touch = await browser.newPage({ viewport: { width: 180, height: 180 } });
await touch.setContent(`<!doctype html><body style="margin:0"><svg width="180" height="180" viewBox="0 0 64 64"><defs>${ICON_DEFS}</defs><rect width="64" height="64" fill="#07070F"/>${ICON_ART(0.82, 32, 32)}</svg></body>`);
await touch.screenshot({ path: "public/apple-touch-icon.png" });

await browser.close();
await writeFile(new URL("../public/.og-generated", import.meta.url), new Date().toISOString());
console.log("og.png, apple-touch-icon.png, icon-512.png generated");
