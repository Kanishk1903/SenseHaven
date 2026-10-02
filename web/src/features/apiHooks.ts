/** Typed API hooks per feature. All polling respects the lean spec: 5 s live, 15 s elsewhere. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { activeFixture, fixtureLive, fixtureOverview, fixtureTimeline, fixtureAppUsage,
         fixtureSessions, fixtureAlerts } from "@/lib/fixture";


// ---- Fixture harness (spec 7): dev/test-only, stripped from production builds ----

/** Query function that serves fixture data when `?fixture=` is present (dev only).
 *  `loading` never settles; `error` rejects. */
function withFixture<T>(real: () => Promise<T>, fixtureData: () => T): () => Promise<T> {
  const name = activeFixture();
  if (!name) return real;
  if (name === "loading") return () => new Promise<T>(() => {});
  if (name === "error") return () => Promise.reject(new Error("Fixture error"));
  return () => Promise.resolve(fixtureData());
}


export type LiveState = {
  state: "unpaired" | "offline" | "active" | "cooldown" | "locked";
  device: {
    id: string;
    name: string;
    last_seen_at: string | null;
    stale: boolean;
    battery_pct: number | null;
    camera_ok: boolean;
    permissions: Record<string, unknown>;
  } | null;
  session: {
    id: string;
    status: string;
    granted_s: number;
    bonus_s: number;
    penalty_s: number;
    used_s: number;
  } | null;
  calm_index: { value: number; label: string; ts: string } | null;
  remaining_s: number | null;
};

export type Overview = {
  range: string;
  screen_time_s: number;
  avg_calm: number | null;
  avg_calm_trend_pct: number | null;
  stress_episodes: number;
  bonus_s: number;
  penalty_s: number;
  sessions_count: number;
};

export type TimelineBucket = { t: string; value: number | null; n: number };
export type Timeline = { date: string; tz: string; buckets: TimelineBucket[] };

export type AppUsage = { items: { package: string; label: string; seconds: number; blocked: boolean }[]; other_seconds: number };

export type LedgerRow = { ts: string; kind: string; seconds: number; reason: string | null };
export type SessionRow = {
  id: string;
  status: string;
  granted_s: number;
  bonus_s: number;
  penalty_s: number;
  used_s: number;
  started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  source: string;
  avg_calm: number | null;
  ledger: LedgerRow[];
};

export type AlertRow = {
  id: string;
  child_id: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

export function useLive(childId: string | undefined) {
  return useQuery({
    queryKey: ["live", childId],
    queryFn: withFixture(() => api.get<LiveState>(`/children/${childId}/live`),
                          () => fixtureLive(activeFixture() ?? "live-neutral")),
    enabled: Boolean(childId),
    refetchInterval: 5_000,
  });
}

export function useOverview(childId: string | undefined, range: string) {
  return useQuery({
    queryKey: ["overview", childId, range],
    queryFn: withFixture(() => api.get<Overview>(`/children/${childId}/analytics/overview?range=${range}`),
                          () => fixtureOverview(activeFixture() ?? "live-neutral")),
    enabled: Boolean(childId),
    refetchInterval: 15_000,
  });
}

export function useTimeline(childId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["timeline", childId, date],
    queryFn: withFixture(() => api.get<Timeline>(`/children/${childId}/analytics/emotion-timeline?date=${date}`),
                          () => fixtureTimeline(activeFixture() ?? "live-neutral")),
    enabled: Boolean(childId),
    refetchInterval: 15_000,
  });
}

export function useAppUsage(childId: string | undefined, range: string) {
  return useQuery({
    queryKey: ["appUsage", childId, range],
    queryFn: withFixture(() => api.get<AppUsage>(`/children/${childId}/analytics/app-usage?range=${range}`),
                          () => fixtureAppUsage(activeFixture() ?? "live-neutral")),
    enabled: Boolean(childId),
    refetchInterval: 15_000,
  });
}

export function useSessions(childId: string | undefined, range: string) {
  return useQuery({
    queryKey: ["sessions", childId, range],
    queryFn: withFixture(() => api.get<SessionRow[]>(`/children/${childId}/analytics/sessions?range=${range}`),
                          () => fixtureSessions(activeFixture() ?? "live-neutral")),
    enabled: Boolean(childId),
    refetchInterval: 15_000,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: withFixture(() => api.get<AlertRow[]>("/alerts"),
                          () => fixtureAlerts(activeFixture() ?? "live-neutral")),
    refetchInterval: 15_000,
  });
}

function useInvalidateLive() {
  const queryClient = useQueryClient();
  return (childId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["live", childId] });
    void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["overview"] });
    void queryClient.invalidateQueries({ queryKey: ["timeline"] });
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["appUsage"] });
  };
}

export function useStartSession(childId: string | undefined) {
  const invalidate = useInvalidateLive();
  return useMutation({
    mutationFn: (durationMin: number) =>
      api.post<{ id: string }>(`/children/${childId}/sessions`, { duration_min: durationMin }),
    onSuccess: () => invalidate(childId),
  });
}

export function useSessionCommand(childId: string | undefined) {
  const invalidate = useInvalidateLive();
  return useMutation({
    mutationFn: ({ sessionId, action, body }: { sessionId: string; action: "end" | "lock" | "adjust"; body?: unknown }) =>
      api.post<Record<string, unknown>>(`/sessions/${sessionId}/${action}`, body ?? {}),
    onSuccess: () => invalidate(childId),
  });
}

export function useAlertsMutations() {
  const queryClient = useQueryClient();
  const markRead = useMutation({
    mutationFn: (alertId: string) => api.post(`/alerts/${alertId}/read`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => api.post("/alerts/read-all"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
  return { markRead, markAllRead };
}
