/** Overview — "Quiet instrument" (v2 spec 4): answer-first status sentence, one raised Now
 *  panel, Today ledger with dotted leaders, day ribbon, Worth-a-look alerts, Top apps.
 *  Named grid areas (.overview-grid), min-width: 0 on every child, no absolute layout. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api";
import { handleApiError } from "@/lib/handleApiError";
import { formatDuration } from "@/lib/format";
import { useChild } from "@/app/childSelection";
import { useChildren } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DurationPicker } from "@/components/DurationPicker";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { OrbMark } from "@/components/OrbMark";
import { SkeletonCard } from "@/components/Skeleton";
import { StatusChip, type StatusKind } from "@/components/StatusChip";
import { DayRibbon } from "@/components/charts/DayRibbon";
import {
  useAlerts,
  useAlertsMutations,
  useAppUsage,
  useLive,
  useOverview,
  useSessionCommand,
  useSessions,
  useStartSession,
  useTimeline,
  type AlertRow,
  type LiveState,
} from "@/features/apiHooks";

type Bucket = { t: string; value: number | null; n: number };

function humanAgo(lastSeenAt: string | null, nowMs: number): { text: string; stale: boolean } {
  if (!lastSeenAt) return { text: "not seen yet", stale: true };
  const seconds = Math.max(0, Math.round((nowMs - new Date(lastSeenAt).getTime()) / 1000));
  if (seconds < 60) return { text: "just now", stale: false };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { text: `${minutes} min ago`, stale: seconds > 90 };
  const hours = Math.floor(minutes / 60);
  return { text: `${hours} h ${minutes % 60} min ago`, stale: true };
}

/** Status sentence (spec 4.4) — answers "Is everything OK right now?" in plain words. */
function statusSentence(live: LiveState, name: string, lastStressAt: string | null): { h1: string } {
  const first = name || "Your child";
  const sinceText = (lastSeenAt: string | null): string => {
    if (!lastSeenAt) return "a while";
    const minutes = Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 60_000);
    if (minutes < 60) return `${Math.max(1, minutes)} min`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  };
  switch (live.state) {
    case "active": {
      const label = live.calm_index?.label;
      const rawMinutes = Math.max(0, live.remaining_s ?? 0) / 60;
      if (rawMinutes < 5) return { h1: `${Math.ceil(rawMinutes)} min left in ${name}'s session.` };
      const minutes = Math.round(rawMinutes);
      if (label === "calm") return { h1: `${first} is calm. ${minutes} min left in this session.` };
      if (label === "stressed" && lastStressAt) {
        const at = new Date(lastStressAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return { h1: `${first} has had a tense few minutes. A breather was offered at ${at}.` };
      }
      return { h1: `${first} is doing okay. ${minutes} min left in this session.` };
    }
    case "cooldown": {
      const at = lastStressAt
        ? new Date(lastStressAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "recently";
      return { h1: `${first} has had a tense few minutes. A breather was offered at ${at}.` };
    }
    case "offline":
      return { h1: `${first}'s phone hasn't checked in for ${sinceText(live.device?.last_seen_at ?? null)}. Limits still apply.` };
    case "locked":
      return live.session === null
        ? { h1: `${first} isn't in a session right now.` }
        : { h1: `${first}'s phone is locked.` };
    default:
      return { h1: `${first} isn't in a session right now.` };
  }
}

function insightSentence(buckets: Bucket[], name: string): string | null {
  const withValues = buckets.filter((b) => b.value !== null);
  if (withValues.length < 30) return null;
  const byHour = new Map<number, number[]>();
  for (const b of withValues) {
    const h = new Date(b.t).getHours();
    (byHour.get(h) ?? byHour.set(h, []).get(h)!).push(b.value!);
  }
  let calmestHour = -1;
  let calmestAvg = -1;
  for (const [hour, values] of byHour) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg > calmestAvg) {
      calmestAvg = avg;
      calmestHour = hour;
    }
  }
  let episodes = 0;
  let inStress = false;
  for (const b of withValues) {
    if (b.value! < 35 && !inStress) episodes += 1;
    inStress = b.value! < 35;
  }
  const fmt = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
  let sentence = `${name} was calmest between ${fmt(calmestHour)} and ${fmt((calmestHour + 1) % 24)}`;
  if (episodes > 0) sentence += ` and had ${episodes} stress episode${episodes > 1 ? "s" : ""} during the day`;
  return sentence + ".";
}

function AddTimePopover({ sessionId, queued = false }: { sessionId?: string; queued?: boolean }) {
  const [minutes, setMinutes] = useState<number | null>(10);
  const { child } = useChild();
  const command = useSessionCommand(child?.id);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="primary" disabled={!sessionId}>
          <Plus size={16} aria-hidden /> {queued ? "Add time when back online" : "Add time"}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-2 text-secondary font-medium">
          {queued ? "Add time — it will apply when the phone reconnects." : "Add 10 more minutes?"}
        </p>
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
              toast.success(queued ? `Queued +${minutes} min for when the phone reconnects` : `Added ${minutes} min`, {
                action: {
                  label: "Undo",
                  onClick: () => {
                    void command.mutateAsync({
                      sessionId: sessionId!,
                      action: "adjust",
                      body: { delta_seconds: -(minutes ?? 0) * 60, reason: "Undo add time" },
                    });
                  },
                },
              });
              setMinutes(null);
            } catch (error) {
              await handleApiError(error);
            }
          }}
        >
          Add {minutes ?? ""} min
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function UpdatedLine({ lastSeenAt }: { lastSeenAt: string | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => force((v) => v + 1), 5000);
    return () => clearInterval(timer);
  }, []);
  const { text, stale } = humanAgo(lastSeenAt, Date.now());
  return (
    <p className="mt-5 flex flex-wrap items-center gap-2 text-caption">
      <span className={`font-mono ${stale ? "text-neutral-fg" : "text-text-subtle"}`}>
        Last checked in <span data-nowrap>{text}</span>
      </span>
      <span className="text-text-subtle">· Calm Index is an estimate</span>
      {stale ? (
        <button type="button" className="inline-flex min-h-11 items-center px-1 text-primary underline underline-offset-2 lg:min-h-6" onClick={() => window.location.reload()}>
          Refresh
        </button>
      ) : null}
    </p>
  );
}

function NowPanel() {
  const { child } = useChild();
  const live = useLive(child?.id);
  const command = useSessionCommand(child?.id);
  const alerts = useAlerts();
  const name = child?.name ?? "Your child";

  if (live.isPending) return <SkeletonCard lines={8} className="min-h-[300px]" />;
  if (live.isError) {
    return (
      <ErrorState
        message={live.error.message}
        onRetry={() => void live.refetch()}
        requestId={live.error instanceof ApiError ? live.error.requestId : null}
      />
    );
  }
  const state = live.data;
  const session = state.session;
  const offline = state.state === "offline";
  const active = state.state === "active";
  const lockedSession = state.state === "locked" && session !== null;
  const lastStressAt =
    alerts.data?.find((a) => a.kind === "stress_alert" && a.child_id === child?.id)?.created_at ?? null;
  const sentence = statusSentence(state, name, lastStressAt);
  const fraction =
    session && session.granted_s + session.bonus_s > 0
      ? Math.max(0, Math.min(1, (state.remaining_s ?? 0) / (session.granted_s + session.bonus_s)))
      : 0;

  return (
    <section className="h-full rounded-panel border border-border bg-surface p-[clamp(12px,2.5vw,1.25rem)]" aria-label="Current status">
      <p className="text-caption font-medium tracking-wide text-text-subtle">Now</p>
      {offline ? (
        <p className="mt-2 text-secondary text-text-muted">
          Limits still work offline. Anything you change here will apply when the phone reconnects.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* ring + orb (176px, orb 96px inside; time sits to the RIGHT, not inside) */}
        <div
          className={cn("relative shrink-0", offline && "opacity-90")}
          role="timer"
          aria-label={`${Math.max(0, Math.round((state.remaining_s ?? 0) / 60))} minutes left`}
        >
          <div className="relative flex h-[176px] w-[176px] items-center justify-center">
            <svg viewBox="0 0 176 176" className="absolute inset-0 -rotate-90">
              <circle
                cx="88" cy="88" r="83" fill="none"
                stroke={offline ? "var(--rule-strong)" : "var(--rule)"}
                strokeWidth="10"
                strokeDasharray={offline ? "4 6" : undefined}
              />
              {!offline ? (
                <circle
                  cx="88" cy="88" r="83" fill="none"
                  stroke={active && (state.remaining_s ?? 0) < 5 * 60 ? "var(--neutral)" : "var(--primary)"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 83}
                  strokeDashoffset={2 * Math.PI * 83 * (1 - fraction)}
                />
              ) : null}
            </svg>
            <OrbMark
              size={96}
              state={offline ? "offline" : state.calm_index?.label === "calm" ? "calm" : state.calm_index?.label === "stressed" ? "stressed" : "neutral"}
              breathe={active && state.calm_index?.label === "calm"}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-h2 font-semibold text-text">
            {sentence.h1}
          </p>

          {state.calm_index ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="tnum font-display text-[1.75rem] font-semibold leading-8 text-text" data-nowrap>
                {state.calm_index.value}
              </span>
              <span className="inline-flex items-center" data-nowrap>
                <StatusChip kind={state.calm_index.label as StatusKind} />
              </span>
              <span className="text-caption text-text-subtle">estimated from facial expressions</span>
            </div>
          ) : (
            <p className="mt-3 text-secondary text-text-muted">No calm readings yet this session.</p>
          )}

          {state.remaining_s !== null ? (
            <p className="mt-3">
              <span className="tnum inline-block font-display text-[2.5rem] font-semibold leading-none text-text" data-nowrap>
                {Math.floor(Math.max(0, state.remaining_s) / 60)}
                <span className="ml-1.5 inline-block align-baseline font-sans text-[1.375rem] font-normal text-text-muted">min</span>
              </span>
              <span className="ml-2 inline-block max-w-full text-secondary text-text-subtle">left in this session</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* actions: state-driven (spec 4.2) — disabled actions carry their reason in text beneath */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {active ? <AddTimePopover sessionId={session?.id} /> : null}
        {offline ? <AddTimePopover sessionId={session?.id} queued /> : null}
        {session && active ? (
          <LockButton sessionId={session.id} disabled={command.isPending} name={name} />
        ) : null}
        {offline ? (
          <Button variant="secondary" disabled>
            <Lock size={16} aria-hidden /> Lock now
          </Button>
        ) : null}
        {session && (active || state.state === "cooldown") ? <MoreMenu sessionId={session.id} name={name} /> : null}
        {session && state.state === "cooldown" ? (
          <LockButton sessionId={session.id} disabled={command.isPending} name={name} />
        ) : null}
        {(state.state === "locked" || state.state === "unpaired") ? <StartSessionButton /> : null}
      </div>
      {offline ? (
        <p className="mt-2 text-caption text-text-subtle">Locking applies when the phone reconnects; add-time is queued.</p>
      ) : null}
      {state.state === "cooldown" ? (
        <p className="mt-2 text-caption text-text-subtle">A breather is running; add-time resumes after it ends.</p>
      ) : null}
      {lockedSession ? (
        <p className="mt-2 text-caption text-text-subtle">A locked session can't be changed. Start a new session instead.</p>
      ) : null}

      <UpdatedLine lastSeenAt={state.device?.last_seen_at ?? null} />
    </section>
  );
}

function LockButton({ sessionId, disabled, name }: { sessionId: string; disabled: boolean; name: string }) {
  const { child } = useChild();
  const command = useSessionCommand(child?.id);
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <Popover open onOpenChange={setConfirming}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <p className="text-secondary font-medium">Lock {name}'s phone now?</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              disabled={disabled}
              onClick={async () => {
                try {
                  await command.mutateAsync({ sessionId, action: "lock" });
                  toast.success("Phone locked");
                } catch (error) {
                  await handleApiError(error);
                }
                setConfirming(false);
              }}
            >
              Lock now
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <Button variant="secondary" disabled={disabled} onClick={() => setConfirming(true)}>
      <Lock size={16} aria-hidden /> Lock now
    </Button>
  );
}

function MoreMenu({ sessionId, name }: { sessionId: string; name: string }) {
  const { child } = useChild();
  const command = useSessionCommand(child?.id);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" aria-label="More actions">
          <MoreHorizontal size={16} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <Button
          variant="ghost"
          className="w-full justify-start"
          disabled={command.isPending}
          onClick={async () => {
            try {
              await command.mutateAsync({ sessionId, action: "end" });
              toast.success(`Session ended for ${name}`);
            } catch (error) {
              await handleApiError(error);
            }
          }}
        >
          End session
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function StartSessionButton() {
  const { child } = useChild();
  const start = useStartSession(child?.id);
  const [minutes, setMinutes] = useState<number | null>(30);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="primary">
          <Plus size={16} aria-hidden /> Start session
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
              toast.success("Session queued — the phone will show it shortly");
            } catch (error) {
              await handleApiError(error);
            }
          }}
        >
          Start {minutes ?? ""} min
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function TodayLedger() {
  const { child } = useChild();
  const overview = useOverview(child?.id, "today");
  if (overview.isPending) return <SkeletonCard lines={4} />;
  if (overview.isError) {
    return <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />;
  }
  const data = overview.data!;
  const rows: { label: string; value: React.ReactNode; caption?: string }[] = [
    { label: "Screen time", value: <span data-nowrap>{formatDuration(data.screen_time_s)}</span> },
    {
      label: "Average calm",
      value: (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span data-nowrap>{data.avg_calm !== null ? data.avg_calm : "—"}</span>
          {data.avg_calm_trend_pct !== null ? (
            <span className="tnum text-caption text-neutral-fg">
              ▾ {Math.abs(data.avg_calm_trend_pct)}% vs last 7 days
            </span>
          ) : null}
        </span>
      ),
    },
    { label: "Breathers started", value: String(data.stress_episodes), caption: "moments the app suggested a pause" },
    { label: "Bonus earned", value: formatDuration(data.bonus_s), caption: `${formatDuration(data.penalty_s)} lost to penalties` },
  ];
  return (
    <section aria-label="Today in numbers">
      <ul role="list" className="m-0 list-none p-0">
        {rows.map((row) => (
          <li key={row.label}>
            {/* leader row: label ··· value — captions live on their own sub-line (spec 4.3) */}
            <div className="ledger-row">
              <span className="ledger-label text-body text-text-muted">{row.label}</span>
              <span className="ledger-rule" aria-hidden />
              <span className="ledger-value text-body">{row.value}</span>
            </div>
            {row.caption ? (
              <p className="pl-0.5 text-caption text-text-subtle">{row.caption}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function WorthALook() {
  const alerts = useAlerts();
  const { markRead } = useAlertsMutations();
  const rows = dedupeAlerts((alerts.data ?? []).slice(0, 8));
  return (
    <section aria-label="Worth a look">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-h3 font-semibold text-text">Worth a look</h2>
        <Link to="/alerts" className="inline-flex min-h-11 items-center px-1 text-secondary text-primary underline-offset-2 hover:underline lg:min-h-6">
          All alerts
        </Link>
      </div>
      {alerts.isPending ? (
        <SkeletonCard lines={4} className="mt-2" />
      ) : rows.length === 0 ? (
        <p className="mt-2 text-secondary text-text-muted">Nothing to report — all quiet.</p>
      ) : (
        <ul className="mt-1">
          {rows.map((alert) => (
            <li key={alert.key} className="border-b border-[var(--rule)] py-2 last:border-0">
              <p className={cn("text-secondary", !alert.read && "font-semibold")}>
                {!alert.read ? (
                  <span aria-hidden className="mr-2 inline-block h-2 w-2 rounded-pill bg-primary align-middle" />
                ) : null}
                {alert.title}
                {alert.count > 1 ? ` (${alert.count} times)` : ""}
              </p>
              <p className="text-caption text-text-subtle">
                {alert.time}
                {!alert.read ? (
                  <>
                    {" · "}
                    <button type="button" className="inline-flex min-h-11 items-center px-1 text-primary underline underline-offset-2 lg:min-h-6" onClick={() => markRead.mutate(alert.id)}>
                      Mark read
                    </button>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Group consecutive identical alerts within 10 minutes (spec 4.7, fixes D12). */
function dedupeAlerts(rows: AlertRow[]): { key: string; title: string; time: string; read: boolean; count: number; id: string }[] {
  const out: { key: string; title: string; time: string; read: boolean; count: number; id: string }[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    const same =
      last && last.title === row.title &&
      Math.abs(new Date(row.created_at).getTime() - new Date(last.time).getTime()) < 10 * 60_000;
    if (same) {
      last.count += 1;
      last.read = last.read && row.read_at !== null;
    } else {
      out.push({
        key: row.id,
        title: row.title,
        time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        read: row.read_at !== null,
        count: 1,
        id: row.id,
      });
    }
  }
  return out.slice(0, 5);
}

function Initial({ label }: { label: string }) {
  const initials = label.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-caption font-semibold text-primary">
      {initials}
    </span>
  );
}

function TopAppsSection() {
  const { child } = useChild();
  const usage = useAppUsage(child?.id, "today");
  if (usage.isPending) return <SkeletonCard lines={3} />;
  if (usage.isError) return <ErrorState message={usage.error.message} onRetry={() => void usage.refetch()} />;
  const items = usage.data!.items.slice(0, 5);
  const max = Math.max(...items.map((item) => item.seconds), 1);
  return (
    <section aria-label="Top apps today">
      <h2 className="font-display text-h3 font-semibold text-text">Top apps today</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-secondary text-text-muted">App usage shows up once the phone has been in use.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {items.map((item) => (
            <li key={item.package} className="flex items-center gap-3">
              <Initial label={item.label || item.package} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-secondary font-medium" title={item.label || item.package} data-allow-truncate>
                    {item.label || item.package}
                  </span>
                  <span className="tnum text-secondary text-text-muted" data-nowrap>{formatDuration(item.seconds)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-pill bg-surface-2">
                  <div className="h-1.5 rounded-pill bg-primary" style={{ width: `${Math.max((item.seconds / max) * 100, 4)}%` }} />
                </div>
              </div>
              {item.blocked ? (
                <span className="rounded-pill bg-stress-soft px-2 py-0.5 text-caption font-medium text-stress-fg">Blocked</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OverviewPage() {
  const { child, select: selectChild } = useChild();
  const children = useChildren();

  const live = useLive(child?.id);
  const overview = useOverview(child?.id, "today");
  const timeline = useTimeline(child?.id, "2026-10-02");
  const sessions = useSessions(child?.id, "today");

  const empty = children.data !== undefined && children.data.length === 0;
  // isLoading (pending AND fetching): disabled queries stay isPending forever when no child exists
  const loading = children.isPending || live.isLoading || overview.isLoading;
  const anyError = [live, overview, timeline, sessions].find((q) => q.isError);

  const buckets = timeline.data?.buckets ?? [];
  const insight = child ? insightSentence(buckets, child.name) : null;
  const episodes = (sessions.data ?? [])
    .flatMap((s) => s.ledger.filter((e) => e.kind === "stress_alert").map((e) => ({ t: e.ts, label: "stress episode", id: `${s.id}-${e.ts}` })));
  const brackets = (sessions.data ?? [])
    .filter((s) => s.started_at)
    .map((s) => ({
      from: s.started_at!,
      to: s.ended_at ?? new Date().toISOString(),
      label: formatDuration(s.granted_s),
    }));

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const sentence = live.data ? statusSentence(live.data, child?.name ?? "Your child", null) : null;

  return (
    <main
      data-testid={loading ? "overview-loading" : "overview-ready"}
      className="mx-auto w-full max-w-[1180px] px-[clamp(8px,2.5vw,2rem)] pb-10 pt-6 lg:px-8"
    >
      {empty ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <EmptyState
            title="No device connected yet"
            body="Add your child and pair their phone to see live status, calm data and app usage."
            action={
              <Link to="/onboarding" className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 font-medium text-on-primary hover:bg-primary-hover">
                Set up your child's phone
              </Link>
            }
          />
        </div>
      ) : loading ? (
        <div className="space-y-6" aria-busy>
          <SkeletonCard lines={2} className="h-24" />
          <div className="overview-grid">
            <SkeletonCard lines={9} className="area-now" />
            <SkeletonCard lines={4} className="area-today" />
          </div>
        </div>
      ) : anyError ? (
        <ErrorState
          message={anyError.error.message}
          onRetry={() => void anyError.refetch()}
          requestId={anyError.error instanceof ApiError ? anyError.error.requestId : null}
        />
      ) : (
        <>
          <header className="mb-6">
            <p className="text-caption text-text-subtle" data-nowrap>
              {greeting}
            </p>
            <h1 className="mt-1 font-display text-h1 font-semibold text-text">
              {sentence?.h1}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-secondary text-text-muted">
              <span className="font-mono">
                Last checked in <span data-nowrap>{live.data ? humanAgo(live.data.device?.last_seen_at ?? null, Date.now()).text : "…"}</span>
              </span>
              <span>· Calm Index is an estimate</span>
            </p>
            {children.data && children.data.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {children.data.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectChild(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-caption",
                      c.id === child?.id && "border-primary",
                    )}
                  >
                    <OrbMark size={16} state="neutral" />
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}
          </header>

          <div className="overview-grid">
            <div className="area-now">
              <NowPanel />
            </div>

            <div className="area-today">
              <TodayLedger />
              <div className="mt-6 border-t border-[var(--rule)] pt-4">
                <WorthALook />
              </div>
              <div className="mt-6 border-t border-[var(--rule)] pt-4">
                <TopAppsSection />
              </div>
            </div>

            <div className="area-ribbon">
              {insight ? (
                <p className="mb-2 text-secondary text-text">{insight}</p>
              ) : null}
              <DayRibbon
                buckets={buckets}
                episodes={episodes}
                sessions={brackets}
                ariaLabel="Calm Index ribbon for today"
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
