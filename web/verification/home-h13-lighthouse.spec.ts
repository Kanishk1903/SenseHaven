/** H13 — Lighthouse mobile profile: performance ≥ 90, a11y ≥ 95, best-practices ≥ 95,
 *  SEO ≥ 95 (also provides the H16 LCP evidence). */
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { chromium, expect, test } from "@playwright/test";

const pExecFile = promisify(execFile);
const BASE = "http://127.0.0.1:4175";

test("H13 · Lighthouse mobile: perf ≥ 90, a11y ≥ 95, best-practices ≥ 95, SEO ≥ 95", async () => {
  const chrome = chromium.executablePath();
  const out = join(mkdtempSync(join(tmpdir(), "lh-home-")), "report.json");
  await pExecFile(
    "npx",
    [
      "lighthouse", `${BASE}/`,
      "--preset=perf",
      "--form-factor=mobile", "--screenEmulation.mobile",
      "--only-categories=performance,accessibility,best-practices,seo",
      "--output=json", `--output-path=${out}`,
      "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
      "--max-wait-for-load=90000",
      "--quiet",
    ],
    { env: { ...process.env, CHROME_PATH: chrome }, timeout: 240_000 },
  );
  const report = JSON.parse(readFileSync(out, "utf8")) as {
    categories: Record<string, { score: number | null }>;
    audits: Record<string, { numericValue?: number }>;
  };
  const scores = Object.fromEntries(Object.entries(report.categories).map(([k, v]) => [k, v.score ?? 0]));
  expect.soft(scores.performance, `performance ${scores.performance}`).toBeGreaterThanOrEqual(0.9);
  expect.soft(scores.accessibility, `accessibility ${scores.accessibility}`).toBeGreaterThanOrEqual(0.95);
  expect.soft(scores["best-practices"], `best-practices ${scores["best-practices"]}`).toBeGreaterThanOrEqual(0.95);
  expect.soft(scores.seo, `seo ${scores.seo}`).toBeGreaterThanOrEqual(0.95);
  // H16 LCP evidence (budget ≤ 2.0 s) — Lighthouse's throttle profile stands in for Slow 4G
  const lcp = (report.audits["largest-contentful-paint"]?.numericValue ?? 0) / 1000;
  expect.soft(lcp, `LCP ${lcp.toFixed(2)}s ≤ 2.0s`).toBeLessThanOrEqual(2.0);
}, 300_000);
