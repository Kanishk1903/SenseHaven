import { Lock, PauseCircle, PlayCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DurationPicker } from "@/components/DurationPicker";
import { ErrorState } from "@/components/ErrorState";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { Ring } from "@/components/Ring";
import { SkeletonCard } from "@/components/Skeleton";
import { Sparkline } from "@/components/Sparkline";
import { StatusChip, type StatusKind } from "@/components/StatusChip";
import {
  useAlerts,
  useAppUsage,
  useLive,
  useOverview,
  useSessionCommand,
  useStartSession,
  useTimeline,
} from "@/features/apiHooks";
import { useChild } from "@/app/childSelection";
import { formatDuration } from "@/lib/format";
import { useChildren } from "@/lib/queries";
import { handleApiError } from "@/lib/handleApiError";

function UpdatedAgo({ lastSeenAt }: { lastSeenAt: string | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => force((value) => value + 1), 5000);
    return () => clearInterval(timer);
  }, []);
  if (!lastSeenAt) return <span className="text-caption text-text-subtle">Not seen yet</span>;
  const seconds = Math.max(0, Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 1000));
  const stale = seconds > 90;
  return (
    <span className={`text-caption ${stale ? "text-neutral-fg" : "text-text-subtle"}`}>
      Updated {seconds < 5 ? "just now" : `${seconds} s ago`}
      {stale ? " — the phone hasn't checked in for a while" : ""}
    </span>
  );
}

function Initial({ label }: { label: string }) {
  const initials = label
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-caption font-semibold text-primary">
      {initials}
    </span>
  );
}

function AddTimePopover({ sessionId, disabled }: { sessionId?: string; disabled?: boolean }) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const { child } = useChild();
  const command = useSessionCommand(child?.id);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <Plus size={16} aria-hidden /> Add time
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-2 text-secondary font-medium">Give extra time</p>
        <DurationPicker valueMin={minutes} onChange={setMinutes} presets={[5, 10, 15, 30]} min={1} max={480} />
        <Button
          className="mt-3 w-full"
          disabled={!minutes || !sessionId || command.isPending}
          onClick={async () => {
            try {
              await command.mutateAsync({
                sessionId: sessionId!,
                action: "adjust",
                body: { delta_seconds: (minutes ?? 0) * 60, reason: "Added by parent" },
              });
              toast(`Added ${minutes} min`);
              setMinutes(null);
            } catch (error) {
              await handleApiError(error);
            }
          }}
        >
          Add {minutes ? `${minutes} min` : "time"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function StartSessionPopover({ disabled, reason }: { disabled?: boolean; reason?: string }) {
  const [minutes, setMinutes] = useState<number | null>(30);
  const start = useStartSession(useChild().child?.id);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="primary" disabled={disabled} title={reason}>
          <PlayCircle size={16} aria-hidden /> Start session
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-2 text-secondary font-medium">How long?</p>
        <DurationPicker valueMin={minutes} onChange={setMinutes} />
        <Button
          className="mt-3 w-full"
          disabled={!minutes || start.isPending}
          onClick={async () => {
            try {
              await start.mutateAsync(minutes!);
              toast("Session queued — your child can tap to begin");
            } catch (error) {
              await handleApiError(error);
            }
          }}
        >
          Start {minutes ? `${minutes} min` : ""}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function LiveStatusCard() {
  const { child } = useChild();
  const live = useLive(child?.id);
  const command = useSessionCommand(child?.id);
  const timeline = useTimeline(child?.id, new Date().toISOString().slice(0, 10));

  if (live.isLoading) return <SkeletonCard lines={6} className="h-full" />;
  if (live.isError) {
    return (
      <ErrorState
        message={live.error.message}
        onRetry={() => void live.refetch()}
        requestId={live.error instanceof ApiError ? live.error.requestId : null}
      />
    );
  }
  const state = live.data!;
  const statusKind: StatusKind = state.state;
  const session = state.session;
  const granted = session ? session.granted_s + session.bonus_s : 0;
  const fraction = session ? Math.max(0, state.remaining_s ?? 0) / Math.max(granted, 1) : 0;
  const activeOrCooldown = state.state === "active" || state.state === "cooldown";
  // last 30 minutes of calm buckets for the sparkline (gaps stay gaps)
  const sparkPoints = timeline.data
    ? timeline.data.buckets.slice(-30).map((bucket) => bucket.value)
    : [];

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Right now</CardTitle>
        <StatusChip kind={statusKind} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <Ring
              fraction={fraction}
              label={state.remaining_s !== null ? formatDuration(state.remaining_s) : "—"}
              sub="remaining"
            />
            <UpdatedAgo lastSeenAt={state.device?.last_seen_at ?? null} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <p className="tnum text-h1 font-semibold" aria-label="Calm Index">
                {state.calm_index ? state.calm_index.value : "—"}
              </p>
              <div>
                <p className="text-caption font-medium text-text-subtle">Calm Index</p>
                {state.calm_index ? <StatusChip kind={state.calm_index.label as StatusKind} /> : null}
              </div>
            </div>
            <div className="mt-2">
              {state.calm_index ? (
                <Sparkline points={sparkPoints} />
              ) : (
                <p className="text-caption text-text-subtle">No face seen yet during this session.</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AddTimePopover sessionId={session?.id} disabled={!activeOrCooldown} />
              <Button
                variant="outline"
                disabled={!session || !activeOrCooldown || command.isPending}
                onClick={async () => {
                  try {
                    await command.mutateAsync({ sessionId: session!.id, action: "lock" });
                    toast("Lock queued");
                  } catch (error) {
                    await handleApiError(error);
                  }
                }}
              >
                <Lock size={16} aria-hidden /> Lock now
              </Button>
              <Button
                variant="outline"
                disabled={!session || !activeOrCooldown || command.isPending}
                onClick={async () => {
                  try {
                    await command.mutateAsync({ sessionId: session!.id, action: "end" });
                    toast("Session end queued");
                  } catch (error) {
                    await handleApiError(error);
                  }
                }}
              >
                <PauseCircle size={16} aria-hidden /> End session
              </Button>
              <StartSessionPopover
                disabled={state.state === "unpaired" || activeOrCooldown}
                reason={
                  state.state === "unpaired"
                    ? "Pair your child's phone first"
                    : activeOrCooldown
                      ? "A session is already running"
                      : undefined
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TodayKpis() {
  const { child } = useChild();
  const overview = useOverview(child?.id, "today");
  if (overview.isLoading) return <SkeletonCard lines={4} />;
  if (overview.isError) return <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />;
  const data = overview.data!;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Kpi label="Screen time today" value={formatDuration(data.screen_time_s)} />
      <Kpi label="Avg calm" value={data.avg_calm !== null ? String(data.avg_calm) : "—"} trendPct={data.avg_calm_trend_pct} />
      <Kpi label="Stress signals" value={String(data.stress_episodes)} hint="breathers started" />
      <Kpi label="Bonus earned" value={formatDuration(data.bonus_s)} hint={`${formatDuration(data.penalty_s)} penalised`} />
    </div>
  );
}

function CalmTimelineCard() {
  const { child } = useChild();
  const timeline = useTimeline(child?.id, new Date().toISOString().slice(0, 10));
  if (timeline.isLoading) return <SkeletonCard lines={5} />;
  if (timeline.isError) return <ErrorState message={timeline.error.message} onRetry={() => void timeline.refetch()} />;
  const buckets = timeline.data!.buckets.filter((_, index) => index % 5 === 0); // 5-min resolution for display
  const hasData = timeline.data!.buckets.some((bucket) => bucket.value !== null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calm timeline — today</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-40 [&_svg]:overflow-visible">
            <TimelineChart buckets={buckets} />
          </div>
        ) : (
          <p className="py-6 text-center text-secondary text-text-muted">
            No calm data yet today — it appears once a session runs with the camera on.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineChart({ buckets }: { buckets: { t: string; value: number | null }[] }) {
  // Recharts is imported lazily by the analytics page; here we render a compact SVG line.
  const width = 600;
  const height = 150;
  const points = buckets
    .map((bucket, index) => ({ x: (index / Math.max(buckets.length - 1, 1)) * width, value: bucket.value }))
    .filter((point): point is { x: number; value: number } => point.value !== null);
  if (points.length === 0) return null;
  const path = points
    .map((point, index) => {
      const y = height - (point.value / 100) * height;
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Calm index timeline for today">
      <line x1="0" y1={height - 0.7 * height} x2={width} y2={height - 0.7 * height} stroke="var(--border)" strokeDasharray="4 4" />
      <line x1="0" y1={height - 0.35 * height} x2={width} y2={height - 0.35 * height} stroke="var(--border)" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="var(--calm)" strokeWidth="2" />
    </svg>
  );
}

function AlertsFeed() {
  const alerts = useAlerts();
  const latest = alerts.data?.slice(0, 5) ?? [];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Alerts</CardTitle>
        <Link to="/alerts" className="text-secondary font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {alerts.isLoading ? (
          <SkeletonCard lines={3} />
        ) : latest.length === 0 ? (
          <p className="py-4 text-center text-secondary text-text-muted">Nothing to report — all quiet.</p>
        ) : (
          <ul className="space-y-3">
            {latest.map((alert) => (
              <li key={alert.id} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-pill ${alert.read_at ? "bg-border" : "bg-primary"}`}
                />
                <div>
                  <p className="text-secondary font-medium">{alert.title}</p>
                  <p className="text-caption text-text-subtle">
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopAppsCard() {
  const { child } = useChild();
  const usage = useAppUsage(child?.id, "today");
  if (usage.isLoading) return <SkeletonCard lines={3} />;
  if (usage.isError) return <ErrorState message={usage.error.message} onRetry={() => void usage.refetch()} />;
  const items = usage.data!.items.slice(0, 5);
  const max = Math.max(...items.map((item) => item.seconds), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top apps today</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-secondary text-text-muted">
            App usage shows up after a session runs on the phone.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.package} className="flex items-center gap-3">
                <Initial label={item.label || item.package} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-secondary font-medium">{item.label || item.package}</span>
                    <span className="tnum text-caption text-text-muted">{formatDuration(item.seconds)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-pill bg-surface-2">
                    <div
                      className="h-1.5 rounded-pill bg-primary"
                      style={{ width: `${Math.max((item.seconds / max) * 100, 4)}%` }}
                    />
                  </div>
                </div>
                {item.blocked ? (
                  <span className="rounded-pill bg-stress-soft px-2 py-0.5 text-caption font-medium text-stress-fg">
                    Blocked
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewPage() {
  const { child } = useChild();
  const { data: children } = useChildren();

  if (children !== undefined && children.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="text-h3 font-semibold">No device connected yet</p>
          <p className="mt-2 text-secondary text-text-muted">
            Add your child and pair their phone to see live status, calm data and app usage.
          </p>
          <Link
            to="/onboarding"
            className="mt-4 inline-flex h-10 items-center rounded-input bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover"
          >
            Set up your child's phone
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={child ? `${child.name}'s overview` : "Overview"}
        description="Is everything OK right now?"
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveStatusCard />
        </div>
        <TodayKpis />
        <div className="lg:col-span-2">
          <CalmTimelineCard />
        </div>
        <AlertsFeed />
        <div className="lg:col-span-2">
          <TopAppsCard />
        </div>
      </div>
    </div>
  );
}
