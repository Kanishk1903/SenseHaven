import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/DataTable";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonCard } from "@/components/Skeleton";
import {
  useAppUsage,
  useSessions,
  useTimeline,
  type LedgerRow,
  type SessionRow,
  type Timeline,
} from "@/features/apiHooks";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { withFixtureAlways, fixtureTimeline, fixtureAppUsage } from "@/lib/fixture";
import { CalmChart } from "@/components/charts/CalmChart";
import { useChild } from "@/app/childSelection";

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function useDistribution(childId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["timeline", childId, date],
    queryFn: withFixtureAlways(() => api.get<Timeline>(`/children/${childId}/analytics/emotion-timeline?date=${date}`), () => fixtureTimeline("live-neutral")),
    enabled: Boolean(childId),
  });
}

function EmotionTab() {
  const { child } = useChild();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const timeline = useTimeline(child?.id, date);
  const distribution = useDistribution(child?.id, date);

  const buckets = timeline.data?.buckets ?? [];
  const stressEpisodes = useSessions(child?.id, "7d").data?.filter((session) =>
    session.ledger.some((entry: LedgerRow) => entry.kind === "stress_alert"),
  );

  const minutesByLabel = distribution.data?.buckets.reduce(
    (acc, bucket) => {
      if (bucket.value === null) return acc;
      if (bucket.value >= 70) acc.calm += 1;
      else if (bucket.value < 35) acc.stressed += 1;
      else acc.neutral += 1;
      return acc;
    },
    { calm: 0, neutral: 0, stressed: 0 },
  );
  const totalMinutes = minutesByLabel ? minutesByLabel.calm + minutesByLabel.neutral + minutesByLabel.stressed : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))}>
            <ChevronLeft size={16} aria-hidden />
          </Button>
          <span className="tnum text-secondary font-medium">{date}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            disabled={date >= new Date().toISOString().slice(0, 10)}
            onClick={() => setDate(shiftDate(date, 1))}
          >
            <ChevronRight size={16} aria-hidden />
          </Button>
        </div>
        <p className="text-caption text-text-subtle">Bands: calm ≥ 70 · stressed &lt; 35</p>
      </div>

      {!child || timeline.isPending ? (
        <SkeletonCard lines={6} />
      ) : timeline.isError ? (
        <ErrorState message={timeline.error.message} onRetry={() => void timeline.refetch()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Calm Index through the day</CardTitle>
          </CardHeader>
          <CardContent>
            <CalmChart buckets={buckets} height={240} ariaLabel="Calm Index through the day" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Share of the day</CardTitle>
          </CardHeader>
          <CardContent>
            {totalMinutes > 0 && minutesByLabel ? (
              <div className="flex h-6 overflow-hidden rounded-pill" role="img"
                   aria-label={`${Math.round((minutesByLabel.calm / totalMinutes) * 100)}% calm, ${Math.round((minutesByLabel.stressed / totalMinutes) * 100)}% stressed`}>
                <div className="bg-calm" style={{ width: `${(minutesByLabel.calm / totalMinutes) * 100}%` }} />
                <div className="bg-neutral" style={{ width: `${(minutesByLabel.neutral / totalMinutes) * 100}%` }} />
                <div className="bg-stress" style={{ width: `${(minutesByLabel.stressed / totalMinutes) * 100}%` }} />
              </div>
            ) : (
              <p className="py-2 text-secondary text-text-muted">No scored minutes yet for this day.</p>
            )}
            {totalMinutes > 0 && minutesByLabel ? (
              <ul className="mt-2 flex gap-4 text-caption text-text-muted">
                <li>Calm {Math.round((minutesByLabel.calm / totalMinutes) * 100)}%</li>
                <li>Neutral {Math.round((minutesByLabel.neutral / totalMinutes) * 100)}%</li>
                <li>Stressed {Math.round((minutesByLabel.stressed / totalMinutes) * 100)}%</li>
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stress episodes (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {stressEpisodes && stressEpisodes.length > 0 ? (
              <ul className="space-y-2 text-secondary">
                {stressEpisodes.map((session) => (
                  <li key={session.id} className="flex items-baseline justify-between gap-2">
                    <span>
                      {session.started_at ? new Date(session.started_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                    <span className="tnum text-caption text-text-muted">
                      breather started · {formatDuration(session.penalty_s)} penalty
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-secondary text-text-muted">No sustained stress stretches this week.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



function ScreenTimeTab() {
  const { child } = useChild();
  const usage = useAppUsage(child?.id, "7d");
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const daily = useQuery({
    queryKey: ["appUsage", child?.id, range],
    queryFn: withFixtureAlways(
      () => api.get<{ items: { package: string; label: string; seconds: number; blocked: boolean }[]; other_seconds: number }>(
        `/children/${child!.id}/analytics/app-usage?range=${range}`,
      ),
      () => fixtureAppUsage("live-neutral"),
    ),
    enabled: Boolean(child?.id),
  });

  const columns: Column<{ package: string; label: string; seconds: number; blocked: boolean }>[] = [
    { key: "label", header: "App", render: (row) => row.label || row.package, sortValue: (row) => row.label || row.package },
    { key: "seconds", header: "Time", render: (row) => formatDuration(row.seconds), sortValue: (row) => row.seconds },
    {
      key: "blocked",
      header: "Status",
      render: (row) =>
        row.blocked ? (
          <span className="rounded-pill bg-stress-soft px-2 py-0.5 text-caption font-medium text-stress-fg">Blocked</span>
        ) : (
          <span className="text-caption text-text-subtle">Allowed</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["7d", "30d"] as const).map((option) => (
          <Button key={option} size="sm" variant={range === option ? "primary" : "outline"} aria-pressed={range === option} onClick={() => setRange(option)}>
            {option === "7d" ? "Last 7 days" : "Last 30 days"}
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Top apps ({range === "7d" ? "7" : "30"} days)</CardTitle>
        </CardHeader>
        <CardContent>
          {!child || daily.isPending || usage.isPending ? (
            <SkeletonCard lines={5} />
          ) : daily.data && daily.data.items.length > 0 ? (
            <DataTable columns={columns} rows={daily.data.items} getRowKey={(row) => row.package} />
          ) : (
            <p className="py-4 text-center text-secondary text-text-muted">
              App usage appears once the phone runs a session with activity logging on.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionsTab() {
  const { child } = useChild();
  const sessions = useSessions(child?.id, "30d");
  const [expanded, setExpanded] = useState<string | null>(null);

  const columns: Column<SessionRow>[] = [
    { key: "started", header: "Started", render: (row) => (row.started_at ? new Date(row.started_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"), sortValue: (row) => row.started_at ?? "" },
    { key: "used", header: "Used", render: (row) => formatDuration(row.used_s), sortValue: (row) => row.used_s },
    { key: "bonus", header: "Bonus", render: (row) => formatDuration(row.bonus_s), sortValue: (row) => row.bonus_s },
    { key: "penalty", header: "Penalty", render: (row) => formatDuration(row.penalty_s), sortValue: (row) => row.penalty_s },
    { key: "calm", header: "Avg calm", render: (row) => (row.avg_calm !== null ? String(row.avg_calm) : "—"), sortValue: (row) => row.avg_calm ?? -1 },
    {
      key: "status",
      header: "End",
      render: (row) => {
        const labels: Record<string, string> = {
          ended: "Ended by child",
          expired: "Time up",
          locked: "Locked by you",
        };
        const label = labels[row.end_reason ?? ""] ?? row.status;
        return (
          <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-caption text-text-muted">
            {label}
          </span>
        );
      },
    },
    {
      key: "expand",
      header: "",
      render: (row) => (
        <Button size="sm" variant="ghost" aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
          {expanded === row.id ? "Hide" : "Details"}
        </Button>
      ),
    },
  ];

  if (!child || sessions.isPending) return <SkeletonCard lines={6} />;
  if (sessions.isError) return <ErrorState message={sessions.error.message} onRetry={() => void sessions.refetch()} />;
  const rows = sessions.data ?? [];

  return (
    <div className="space-y-4">
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />
      {expanded ? (
        <Card>
          <CardHeader>
            <CardTitle>Session events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-secondary">
              {(rows.find((row) => row.id === expanded)?.ledger ?? []).map((entry) => (
                <li key={`${entry.ts}-${entry.kind}`} className="flex items-baseline justify-between gap-3">
                  <span className="font-mono" data-nowrap>
                    {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                    <span className="font-medium">{entry.kind.replace(/_/g, " ")}</span>
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </span>
                  <span className="tnum text-caption text-text-muted">{entry.seconds > 0 ? formatDuration(entry.seconds) : ""}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function AnalyticsPage() {
  const { child } = useChild();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "emotion";
  return (
    <div>
      <PageHeader title={`${child?.name ?? "Child"} — analytics`} description="Honest data: gaps stay gaps." />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })}>
        <TabsList>
          <TabsTrigger value="emotion">Emotion</TabsTrigger>
          <TabsTrigger value="screen-time">Screen time</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>
        <TabsContent value="emotion" className="mt-4">
          <EmotionTab />
          <p className="mt-3 text-caption text-text-subtle">
            Episodes are moments of sustained stress signals, not diagnoses.
          </p>
        </TabsContent>
        <TabsContent value="screen-time" className="mt-4">
          <ScreenTimeTab />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
