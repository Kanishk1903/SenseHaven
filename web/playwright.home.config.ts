/** Playwright config for `npm run verify:home` (Home spec §12). */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./verification",
  // home gates only — the v2 overview suites run under `npm run verify:ui`
  testMatch: /home.*\.spec\.ts$/,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node ../scripts/serve-dist.mjs",
    env: { PORT: "4175" },
    port: 4175,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
