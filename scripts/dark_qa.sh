#!/usr/bin/env bash
# Dark-mode QA (redesign spec §3.4/§15): boots the production API, captures dark-login and
# dark-overview screenshots into verification/screenshots/web/.
set -euo pipefail
cd "$(dirname "$0")/.."

lsof -ti :8000 | xargs kill -9 2>/dev/null || true
export ENV=production
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://senseheaven:senseheaven@localhost:5432/senseheaven}"
export APP_SECRET="darkqa-secret-not-for-production"
export PAIRING_PEPPER="darkqa-pepper"

(cd api && PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/sh-darkqa.log 2>&1 & echo $! > /tmp/sh-darkqa.pid)
API_PID="$(cat /tmp/sh-darkqa.pid)"
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

bash scripts/warm.sh http://localhost:8000 >/dev/null
api/.venv/bin/python scripts/seed_demo.py >/dev/null 2>&1

cd web
node - << 'NODEEOF'
const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await page.addInitScript(() => localStorage.setItem("sh-theme", "dark"));
  await page.goto("http://localhost:8000/login");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "../verification/screenshots/web/dark-login-1440.png" });
  await page.getByLabel("Email").fill("demo@senseheaven.app");
  await page.getByLabel("Password").fill("demo-password-123");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "../verification/screenshots/web/dark-overview-1440.png" });
  await browser.close();
  console.log("dark shots captured");
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
NODEEOF
echo "dark QA complete"
