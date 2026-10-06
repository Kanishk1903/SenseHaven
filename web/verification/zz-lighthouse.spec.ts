/**
 * G13 (UI-UX v2 spec §8.3) — Lighthouse (desktop): accessibility ≥ 95,
 * performance ≥ 90, best practices ≥ 95. Audits the minified verification build
 * (VITE_FIXTURES=1 vite build) served by the shared preview server.
 */
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { chromium, expect, test } from "@playwright/test";

const pExecFile = promisify(execFile);
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:4173";

async function audit(fixture: string): Promise<Record<string, number>> {
  const chrome = chromium.executablePath();
  const out = join(mkdtempSync(join(tmpdir(), "lh-")), "report.json");
  await pExecFile(
    "npx",
    [
      "lighthouse", `${BASE}/?fixture=${fixture}`,
      "--preset=desktop",
      "--only-categories=accessibility,performance,best-practices",
      `--output=json`, `--output-path=${out}`,
      "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
      "--max-wait-for-load=90000",
      "--quiet",
    ],
    {
      env: { ...process.env, CHROME_PATH: chrome },
      timeout: 240_000,
    },
  );
  const report = JSON.parse(readFileSync(out, "utf8")) as { categories: Record<string, { score: number | null }> };
  return Object.fromEntries(
    Object.entries(report.categories).map(([k, v]) => [k, v.score ?? 0]),
  );
}

test("G13 · Lighthouse desktop: a11y ≥ 0.95, performance ≥ 0.90, best-practices ≥ 0.95", async () => {
  const scores = await audit("offline");
  expect.soft(scores.accessibility, `accessibility ${scores.accessibility}`).toBeGreaterThanOrEqual(0.95);
  expect.soft(scores.performance, `performance ${scores.performance}`).toBeGreaterThanOrEqual(0.90);
  expect.soft(scores["best-practices"], `best-practices ${scores["best-practices"]}`).toBeGreaterThanOrEqual(0.95);
}, 300_000);
