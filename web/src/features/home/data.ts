/** Home demo + sample-day data (spec §4.2/§4.4).
 *  Plain constants — NOT part of the ?fixture= harness: the public page ships them in
 *  production. Values mirror the real fixtures and the BEFORE screenshot's shape. */
import type { LiveState } from "@/features/apiHooks";
import type { RibbonBucket, RibbonMarker, SessionBracket } from "@/components/charts/DayRibbon";

export type DemoStateName = "live-calm" | "live-neutral" | "live-stressed";

/** 2026-10-02T23:10+05:30 frozen "now", same convention as the verification fixtures. */
export const DEMO_NOW = "2026-10-02T17:40:00.000Z";

const demoDevice = {
  id: "demo-device",
  name: "Aarav's phone",
  last_seen_at: DEMO_NOW,
  stale: false,
  battery_pct: 76,
  camera_ok: true,
  permissions: { camera: true, notifications: true, usage_access: true, overlay: true },
};

export const DEMO_STATES: Record<DemoStateName, LiveState> = {
  "live-calm": {
    state: "active",
    device: demoDevice,
    session: { id: "demo-session", status: "active", granted_s: 1800, bonus_s: 600, penalty_s: 0, used_s: 520 },
    calm_index: { value: 71, label: "calm", ts: DEMO_NOW },
    remaining_s: 1320,
  },
  "live-neutral": {
    state: "active",
    device: demoDevice,
    session: { id: "demo-session", status: "active", granted_s: 1800, bonus_s: 600, penalty_s: 0, used_s: 520 },
    calm_index: { value: 58, label: "neutral", ts: DEMO_NOW },
    remaining_s: 1320,
  },
  "live-stressed": {
    state: "cooldown",
    device: demoDevice,
    session: { id: "demo-session", status: "cooldown", granted_s: 1800, bonus_s: 600, penalty_s: 300, used_s: 700 },
    calm_index: { value: 24, label: "stressed", ts: DEMO_NOW },
    remaining_s: 1100,
  },
};

export const DEMO_NAMES: Record<DemoStateName, string> = {
  "live-calm": "Aarav is calm. 22 min left in this session.",
  "live-neutral": "Aarav is doing okay. 22 min left in this session.",
  "live-stressed": "Aarav has had a tense few minutes. A breather was offered at 08:12 PM.",
};

/** A sample past day: ~6 h of activity, two sessions, one gap (phone off), one stress
 *  episode with a breather and a recovery. No "Now" marker — this day is over. */
const sampleBuckets: RibbonBucket[] = Array.from({ length: 24 * 60 }, (_, minute) => {
  const t = `2026-10-01T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00+05:30`;
  let value: number | null = null;
  if (minute >= 990 && minute < 1110) value = Math.round(78 + 8 * Math.sin((minute - 990) / 18)); // 16:30–18:30 calm drawing
  if (minute >= 1215 && minute < 1305) value = Math.round(52 + 10 * Math.sin((minute - 1215) / 12)); // 20:15–21:45 games
  if (minute >= 1305 && minute < 1317) value = 26; // 21:45–21:57 tense stretch
  if (minute >= 1317 && minute < 1377) value = 30 + Math.round(28 * ((minute - 1317) / 60)); // breather + recovery
  if (minute >= 1377 && minute < 1420) value = Math.round(64 + 6 * Math.sin((minute - 1377) / 10)); // settled
  return { t, value, n: value === null ? 0 : 1 };
});

export const SAMPLE_DAY = {
  buckets: sampleBuckets,
  episodes: [{ t: "2026-10-01T21:45:00+05:30", label: "Stress episode" }] as RibbonMarker[],
  breathers: [{ t: "2026-10-01T21:57:00+05:30", label: "Breather started" }] as RibbonMarker[],
  sessions: [
    { from: "2026-10-01T16:30:00+05:30", to: "2026-10-01T18:30:00+05:30", label: "2 h" },
    { from: "2026-10-01T20:15:00+05:30", to: "2026-10-01T23:40:00+05:30", label: "3 h 25 min" },
  ] as SessionBracket[],
  /** rules-based insight over the sample day (same shape the Overview computes) */
  insight: "Aarav was calmest between 4 and 5 PM and had one stress episode just after 8 PM.",
};

/** Marginalia annotations: minute-of-day anchors on the sample ribbon (spec §4.4). */
export const SAMPLE_NOTES: { at: number; title: string; note: string }[] = [
  { at: 1030, title: "Calm stretches", note: "Calm stretches look like this. The strip stays in the cooler tones." },
  { at: 1310, title: "A tense few minutes", note: "The strip warms toward coral." },
  { at: 1377, title: "Breather", note: "The app started a short pause on the child's phone after sustained stress signals." },
  { at: 1160, title: "Phone off", note: "We show a gap, not a guess." },
];
