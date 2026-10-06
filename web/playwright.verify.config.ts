/**
 * Playwright config for `npm run verify:ui` (UI-UX v2 spec §8).
 * Audits the minified verification build (VITE_FIXTURES=1) served by vite preview.
 * Screenshot evidence lands in ../verification/shots/ (repo-root verification/shots/).
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./verification",
  // the public-Home gates have their own runner: npm run verify:home
  testIgnore: /home.*\.spec\.ts$/,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    port: 4173, // vite preview binds ::1 — tests resolve via localhost
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
