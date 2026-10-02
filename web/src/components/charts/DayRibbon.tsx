/** DayRibbon (spec 4.6) — the signature visual: a 56px strip of the day where each reading
 *  is coloured by mood (OKLCH interpolation calm → neutral → stress), a 2px Calm Index line
 *  over it, hatched gap regions, session brackets and breather markers below, adaptive time
 *  axis, and a Now marker. Auto-zooms to the active window with a Full-day toggle. */
import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

export type RibbonBucket = { t: string; value: number | null; n: number };
export type RibbonMarker = { t: string; label: string };
export type SessionBracket = { from: string; to: string; label: string };

type Props = {
  buckets: RibbonBucket[];
  episodes?: RibbonMarker[];
  breathers?: RibbonMarker[];
  sessions?: SessionBracket[];
  nowIso?: string;
  /** default: zoom to active window; toggle to full day */
  autoZoom?: boolean;
  className?: string;
  ariaLabel?: string;
};

const W = 900;
const STRIP_H = 56;
const BRACKET_H = 14;
const AXIS_H = 20;
const H = STRIP_H + BRACKET_H + AXIS_H;
const PAD_X = 8;

function minuteOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** OKLCH interpolation: value 0 → stressed hue, 100 → calm hue, through neutral. */
function moodColour(value: number): string {
  const hue = 25 + (value / 100) * 140; // 25 (coral) → 165 (teal)
  const chroma = 0.09 + 0.03 * Math.cos(((value / 100) * Math.PI));
  const light = 0.62 + 0.1 * (value / 100);
  return `oklch(${light.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

function fmtTick(minute: number): string {
  const d = new Date(new Date().setHours(Math.floor(minute / 60), minute % 60, 0, 0));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DayRibbon({
  buckets,
  episodes = [],
  breathers = [],
  sessions = [],
  nowIso,
  autoZoom = true,
  className,
  ariaLabel = "Calm Index ribbon for today",
}: Props) {
  const [fullDay, setFullDay] = useState(!autoZoom);

  const nowMin = useMemo(() => minuteOfDay(nowIso ?? new Date().toISOString()), [nowIso]);
  const samples = useMemo(
    () =>
      buckets
        .map((b) => ({ minute: minuteOfDay(b.t), value: b.value, t: b.t }))
        .filter((s) => s.value !== null) as { minute: number; value: number; t: string }[],
    [buckets],
  );

  const domain = useMemo(() => {
    if (fullDay || samples.length === 0) return { min: 0, max: 24 * 60 };
    const first = samples[0].minute;
    const last = samples[samples.length - 1].minute;
    return { min: Math.max(0, first - 15), max: Math.min(24 * 60, Math.max(last, nowMin) + 15) };
  }, [fullDay, samples, nowMin]);

  const x = useCallback(
    (minute: number) => PAD_X + ((minute - domain.min) / (domain.max - domain.min)) * (W - 2 * PAD_X),
    [domain],
  );

  const visible = useMemo(
    () => samples.filter((s) => s.minute >= domain.min && s.minute <= domain.max),
    [samples, domain],
  );

  // ribbon cells: continuous strip where readings exist; hatched where they don't
  const cells = useMemo(() => {
    const out: { x: number; w: number; colour: string | null }[] = [];
    let cursor = domain.min;
    for (const s of visible) {
      if (s.minute - cursor > 1) out.push({ x: x(cursor), w: x(s.minute) - x(cursor), colour: null });
      const nextMinute = s.minute + 1;
      out.push({ x: x(s.minute), w: Math.max(x(Math.min(nextMinute, domain.max)) - x(s.minute), 1), colour: moodColour(s.value) });
      cursor = Math.max(cursor, nextMinute);
    }
    if (visible.length > 0 && cursor < domain.max) {
      if (cursor < nowMin) out.push({ x: x(cursor), w: x(Math.min(nowMin, domain.max)) - x(cursor), colour: null });
    } else if (visible.length === 0) {
      out.push({ x: x(domain.min), w: x(domain.max) - x(domain.min), colour: null });
    }
    return out;
  }, [visible, domain, x, nowMin]);

  const linePath = useMemo(() => {
    if (visible.length === 0) return "";
    return visible
      .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.minute).toFixed(1)},${(STRIP_H / 2 - ((s.value - 50) / 100) * (STRIP_H - 12)).toFixed(1)}`)
      .join(" ");
  }, [visible, x]);

  const ticks = useMemo(() => {
    const span = domain.max - domain.min;
    const stepMin = [15, 30, 60, 120, 180].find((s) => (span / s) * 100 <= W - 2 * PAD_X) ?? 180;
    const start = Math.ceil(domain.min / stepMin) * stepMin;
    const out: number[] = [];
    for (let m = start; m <= domain.max; m += stepMin) out.push(m);
    return out;
  }, [domain]);

  const nowVisible = nowMin >= domain.min && nowMin <= domain.max;

  return (
    <section aria-label={ariaLabel} className={cn("w-full", className)}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-text-subtle">
          Hatched = no readings. We never guess between samples.
        </p>
        <div className="flex items-center gap-0.5 rounded-control bg-surface-3 p-0.5 text-caption">
          <button
            type="button"
            aria-pressed={!fullDay}
            onClick={() => setFullDay(false)}
            className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-[7px] px-3 lg:min-h-6 lg:min-w-0", !fullDay ? "bg-surface text-text shadow-elev1" : "text-text-muted")}
          >
            Active hours
          </button>
          <button
            type="button"
            aria-pressed={fullDay}
            onClick={() => setFullDay(true)}
            className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-[7px] px-3 lg:min-h-6 lg:min-w-0", fullDay ? "bg-surface text-text shadow-elev1" : "text-text-muted")}
          >
            Full day
          </button>
        </div>
      </div>

      {/* markers are HTML hotspots over the strip (absolute allowed for markers, spec 5.1) */}
      <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
        style={{ minHeight: H }}
      >
        <defs>
          <pattern id="ribbonHatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule-strong)" strokeWidth="1" opacity="0.5" />
          </pattern>
        </defs>

        {/* strip background */}
        <rect x={PAD_X} y={0} width={W - 2 * PAD_X} height={STRIP_H} rx={4} fill="var(--surface-2)" />

        {/* mood cells / gaps */}
        {cells.map((cell, i) =>
          cell.colour ? (
            <rect key={`c${i}`} x={cell.x} y={0} width={cell.w} height={STRIP_H} fill={cell.colour} />
          ) : (
            <rect key={`g${i}`} x={cell.x} y={0} width={cell.w} height={STRIP_H} fill="url(#ribbonHatch)" />
          ),
        )}

        {/* exact-value line */}
        {linePath ? (
          <path d={linePath} fill="none" stroke="var(--text)" strokeWidth="2" opacity="0.85" />
        ) : null}

        {/* rim */}
        <rect x={PAD_X} y={0.5} width={W - 2 * PAD_X} height={STRIP_H} rx={4} fill="none" stroke="var(--rule)" />

        {/* stress episode flags (decorative; the HTML hotspots carry semantics) */}
        {episodes.map((marker) => {
          const m = minuteOfDay(marker.t);
          if (m < domain.min || m > domain.max) return null;
          return <path key={marker.t} d={`M${x(m) - 3},${STRIP_H} l3,-6 3,6 z`} fill="var(--stress)" aria-hidden />;
        })}

        {/* breather markers (decorative) */}
        {breathers.map((marker) => {
          const m = minuteOfDay(marker.t);
          if (m < domain.min || m > domain.max) return null;
          return <circle key={marker.t} cx={x(m)} cy={STRIP_H - 8} r={4} fill="var(--surface)" stroke="var(--stress)" strokeWidth="1.5" aria-hidden />;
        })}

        {/* session brackets */}
        {sessions.map((s) => {
          const from = minuteOfDay(s.from);
          const to = minuteOfDay(s.to);
          if (to < domain.min || from > domain.max) return null;
          const x1 = Math.max(x(from), PAD_X);
          const x2 = Math.min(x(to), W - PAD_X);
          return (
            <g key={s.from}>
              <path
                d={`M${x1},${STRIP_H + 4} v6 H${x2} v-6`}
                fill="none"
                stroke="var(--rule-strong)"
                strokeWidth="1"
              />
              <text x={(x1 + x2) / 2} y={STRIP_H + BRACKET_H - 2} textAnchor="middle" fontSize="12" fill="var(--text-muted)">
                {s.label}
              </text>
            </g>
          );
        })}

        {/* now marker */}
        {nowVisible ? (
          <g>
            <line x1={x(nowMin)} y1={0} x2={x(nowMin)} y2={STRIP_H} stroke="var(--primary)" strokeWidth="1.5" />
            <text x={x(nowMin)} y={STRIP_H + BRACKET_H + 14} textAnchor="middle" fontSize="12" fill="var(--primary)">
              Now
            </text>
          </g>
        ) : null}

        {/* axis */}
        <line x1={PAD_X} y1={STRIP_H + BRACKET_H} x2={W - PAD_X} y2={STRIP_H + BRACKET_H} stroke="var(--rule)" />
        {ticks.map((m) => (
          <g key={m}>
            <line x1={x(m)} y1={STRIP_H + BRACKET_H} x2={x(m)} y2={STRIP_H + BRACKET_H + 4} stroke="var(--rule-strong)" />
            <text x={x(m)} y={STRIP_H + BRACKET_H + 16} textAnchor="middle" fontSize="12" fill="var(--text-subtle)" className="tnum font-mono">
              {fmtTick(m)}
            </text>
          </g>
        ))}
      </svg>
      {[...episodes, ...breathers].map((marker) => {
        const m = minuteOfDay(marker.t);
        if (m < domain.min || m > domain.max) return null;
        return (
          <button
            key={marker.t}
            type="button"
            aria-label={marker.label}
            title={marker.label}
            className="absolute top-0 h-full w-11 -translate-x-1/2 rounded-control hover:bg-surface-3/40"
            style={{ left: `${(x(m) / W) * 100}%` }}
          />
        );
      })}
      </div>
    </section>
  );
}
