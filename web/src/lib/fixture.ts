/** Fixture harness (spec 7): dev/test-only mock layer behind `?fixture=<name>`.
 *  Inactive in normal production builds; also enabled in a minified verification build
 *  via VITE_FIXTURES=1 so the matrix and Lighthouse audit the real optimized bundle.
 *  Fixtures use the real values from the BEFORE screenshot for `offline`. */
import type { QueryClient } from "@tanstack/react-query";
import type { LiveState, Overview, Timeline, SessionRow, AlertRow, AppUsage } from "@/features/apiHooks";
import type { Child, Parent } from "@/lib/queries";

export const FIXTURE_NAMES = [
  "live-calm", "live-neutral", "live-stressed", "session-ending", "offline", "stale",
  "locked", "no-session", "loading", "empty", "error", "long-strings",
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

/** Frozen "now" the tests pin with page.clock.setFixedTime: 2026-10-02T23:10:00+05:30 */
export const FIXTURE_NOW = "2026-10-02T17:40:00.000Z"; // 23:10 IST

export function activeFixture(): FixtureName | null {
  if (!import.meta.env.DEV && import.meta.env.VITE_FIXTURES !== "1") return null;
  const v = new URLSearchParams(window.location.search).get("fixture");
  return (FIXTURE_NAMES as readonly string[]).includes(v ?? "") ? (v as FixtureName) : null;
}

/** Query function wrapper: serves fixture data when `?fixture=` is present.
 *  `loading` never settles; `error` rejects; everything else resolves immediately. */
export function withFixture<T>(real: () => Promise<T>, fixtureData: () => T): () => Promise<T> {
  const name = activeFixture();
  if (!name) return real;
  if (name === "loading") return () => new Promise<T>(() => {});
  if (name === "error") return () => Promise.reject(new Error("Fixture error"));
  return () => Promise.resolve(fixtureData());
}

/** Settings-page fixtures (child settings + paired device) so the whole dashboard
 *  renders from the harness without the API. */
export const FIXTURE_SETTINGS = {
  config_version: 1,
  good_bonus_min: 15,
  stress_penalty_min: 5,
  cooldown_min: 5,
  max_bonus_per_session_min: 30,
  calm_threshold: 70,
  stress_threshold: 35,
  sustained_stress_s: 120,
  sustained_calm_s: 300,
  penalty_lockout_s: 900,
  monitoring_enabled: true,
  activity_log_enabled: true,
  show_mood_to_child: true,
  blocked_packages: ["com.example.blocked"],
  allowed_packages: ["com.example.allowed"],
};

export const FIXTURE_DEVICES = [
  {
    id: "dev-1",
    name: "Aarav's phone",
    android_version: "14",
    app_version: "1.0.0",
    paired_at: "2026-09-20T10:00:00Z",
    last_seen_at: FIXTURE_NOW,
    revoked_at: null,
    permissions: { camera: true, notifications: true, usage_access: true, overlay: true, camera_ok: true },
  },
];

export const FIXTURE_APK = { version: "1.0.0", url: "/apk.json", sha256: "fixture0123456789abcdef", size: 24_117_248 };

/** Auth must never hang or reject under fixtures: it is infrastructure, not page state. */
export function withFixtureAlways<T>(real: () => Promise<T>, fixtureData: () => T): () => Promise<T> {
  if (!activeFixture()) return real;
  return () => Promise.resolve(fixtureData());
}

export const FIXTURE_PARENT: Parent = {
  id: "fixture-parent",
  email: "fixture@senseheaven.app",
  display_name: "Fixture Parent",
  timezone: "Asia/Kolkata",
  has_pin: true,
  created_at: "2026-09-01T10:00:00Z",
};

/** CLS check (G7) simulates a poll refresh by invalidating every query. */
export function installFixtureGlobals(queryClient: QueryClient): void {
  (window as unknown as Record<string, unknown>).__shRefetch = () => {
    void queryClient.invalidateQueries();
  };
}

const child = (name: string): Child => ({
  id: "f0ce-0001",
  name,
  birth_year: 2015,
  avatar_key: "orb-1",
  settings: { config_version: 1 },
  created_at: "2026-09-01T10:00:00Z",
});

const CHILD = child("Aarav");

const baseLive: LiveState = {
  state: "active",
  device: {
    id: "dev-1", name: "Aarav's phone", last_seen_at: FIXTURE_NOW, stale: false,
    battery_pct: 76, camera_ok: true,
    permissions: { camera: true, notifications: true, usage_access: true, overlay: true },
  },
  session: { id: "sess-1", status: "active", granted_s: 1800, bonus_s: 600, penalty_s: 300, used_s: 1020 },
  calm_index: { value: 58, label: "neutral", ts: FIXTURE_NOW },
  remaining_s: 1080,
};

const baseOverview: Overview = {
  range: "today",
  screen_time_s: 12600, // 3 h 30 min
  avg_calm: 68.5,
  avg_calm_trend_pct: -6.9,
  stress_episodes: 1,
  bonus_s: 0,
  penalty_s: 0,
  sessions_count: 2,
};

const baseTimeline: Timeline = {
  date: "2026-10-02", tz: "Asia/Kolkata",
  buckets: Array.from({ length: 24 * 60 }, (_, minute) => {
    const active = minute >= 1110 && minute <= 1420; // 18:30 – 23:40 IST
    const wave = Math.sin((minute - 1110) / 24) * 22 + 62;
    return {
      t: `2026-10-02T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00+05:30`,
      value: active ? Math.round(Math.min(95, Math.max(12, wave))) : null,
      n: active ? 1 : 0,
    };
  }),
};

const baseSessions: SessionRow[] = [{
  id: "sess-1", status: "active", granted_s: 1800, bonus_s: 600, penalty_s: 300, used_s: 1020,
  started_at: "2026-10-02T14:40:00Z", ended_at: null, end_reason: null, source: "parent_web",
  avg_calm: 68.5,
  ledger: [
    { ts: "2026-10-02T15:10:00Z", kind: "stress_alert", seconds: 300, reason: "Sustained stress signals" },
    { ts: "2026-10-02T15:10:00Z", kind: "penalty", seconds: 300, reason: "Stress breather" },
    { ts: "2026-10-02T15:10:00Z", kind: "cooldown_start", seconds: 300, reason: null },
  ],
}];

const baseAlerts: AlertRow[] = [
  { id: "al-1", child_id: CHILD.id, kind: "stress_alert", severity: "warning",
    title: "Aarav had a stressful stretch — a 5-minute breather was started",
    body: "SenseHeaven noticed a long run of stress signals and started a breather.",
    payload: null, created_at: "2026-10-02T23:35:00+05:30", read_at: null },
];

export function fixtureChildren(name: FixtureName): Child[] {
  if (name === "empty") return [];
  if (name === "long-strings") return [child("Aarav International Bartholomew von Hohenzollern-Sigmaringen")];
  return [CHILD];
}

export function fixtureLive(name: FixtureName): LiveState {
  const live = structuredClone(baseLive);
  switch (name) {
    case "live-calm":
      live.calm_index = { value: 82, label: "calm", ts: FIXTURE_NOW };
      break;
    case "live-stressed":
      live.calm_index = { value: 24, label: "stressed", ts: FIXTURE_NOW };
      live.state = "cooldown";
      live.session!.status = "cooldown";
      break;
    case "session-ending":
      live.remaining_s = 260; // 4 min 20 s — under 5 min
      live.session!.used_s = 1640;
      break;
    case "offline":
      live.state = "offline";
      live.device!.stale = true;
      live.device!.last_seen_at = "2026-10-02T23:01:52+05:30"; // 488 s before frozen now (23:10 IST)
      live.calm_index = { value: 58, label: "neutral", ts: "2026-10-02T23:00:00+05:30" };
      break;
    case "stale":
      live.device!.stale = true;
      live.device!.last_seen_at = "2026-10-02T22:55:00+05:30"; // 15 min before frozen now
      live.state = "offline";
      break;
    case "locked":
      // the API returns state "locked" with a live session when the parent locks mid-session
      live.state = "locked";
      live.session!.status = "locked";
      break;
    case "no-session":
      // device fresh, no session running — the API's shape for "locked" with session === null
      live.state = "locked";
      live.session = null;
      live.remaining_s = null;
      break;
    case "error":
    case "loading":
    case "long-strings":
      break;
  }
  if (name === "long-strings") {
    live.device!.name = "Aarav International Bartholomew von Hohenzollern-Sigmaringen's phone";
  }
  return live;
}

export function fixtureOverview(name: FixtureName): Overview {
  const ov = structuredClone(baseOverview);
  if (name === "long-strings") ov.screen_time_s = 46740; // 12 h 59 min
  return ov;
}

export function fixtureTimeline(name: FixtureName): Timeline {
  const tl = structuredClone(baseTimeline);
  if (name === "empty") tl.buckets = tl.buckets.map((b) => ({ ...b, value: null, n: 0 }));
  if (name === "long-strings") {
    tl.buckets = tl.buckets.map((b) => ({ ...b, value: b.value === null ? null : 40 }));
  }
  return tl;
}

export function fixtureSessions(name: FixtureName): SessionRow[] {
  if (name === "empty") return [];
  const rows = structuredClone(baseSessions);
  if (name === "long-strings") rows[0].used_s = 46740;
  return rows;
}

export function fixtureAppUsage(name: FixtureName): AppUsage {
  if (name === "empty") return { items: [], other_seconds: 0 };
  const items = [
    { package: "com.google.android.youtube", label: name === "long-strings" ? "YouTube Kids Stories and Video (very long name)" : "YouTube", seconds: 900, blocked: false },
    { package: "com.android.chrome", label: "Chrome", seconds: 420, blocked: false },
  ];
  return { items, other_seconds: 0 };
}

export function fixtureAlerts(name: FixtureName): AlertRow[] {
  if (name === "empty") return [];
  const rows = structuredClone(baseAlerts);
  if (name === "long-strings") {
    rows[0].title = "Aarav International Bartholomew von Hohenzollern-Sigmaringen had a stressful stretch — a 5-minute breather was started";
  }
  return rows;
}
