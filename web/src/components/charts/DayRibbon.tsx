/** DayRibbon (spec 4.6) — the signature visual: a 56px strip of the day where each reading
 *  is coloured by mood (OKLCH interpolation calm → neutral → stress), a 2px Calm Index line
 *  over it, hatched gap regions, session brackets and breather markers below, adaptive time
 *  axis, and a Now marker. Auto-zooms to the active window with a Full-day toggle. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
const BRACKET_H = 20;
const AXIS_H = 20;
// (strip 56 + brackets 20 + axis 20)
// box height grows with u so every u-scaled y (strip 56u, axis band) renders 1:1:
// rendered px = units × (w/900) = units/u → strip 56px, text 12px at EVERY viewport width
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [renderedW, setRenderedW] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setRenderedW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const u = useMemo(
    () => (renderedW !== null && renderedW > 0 ? W / renderedW : 1),
    [renderedW],
  );

  const linePath = useMemo(() => {
    if (visible.length === 0) return "";
    return visible
      .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.minute).toFixed(1)},${((STRIP_H / 2 - ((s.value - 50) / 100) * (STRIP_H - 12)) * u).toFixed(1)}`)
      .join(" ");
  }, [visible, x, u]);

  // viewBox units per rendered pixel; fontSize 12·u renders at exactly 12 CSS px

const H = Math.round((STRIP_H + BRACKET_H + AXIS_H) * u);

  const ticks = useMemo(() => {
    const span = domain.max - domain.min;
    const stepMin = [30, 60, 120, 180, 360].find((s) => span / s <= 10) ?? 360;
    const start = Math.ceil(domain.min / stepMin) * stepMin;
    // a "10:30 PM" label at 12·u units is ~56·u wide — keep only ticks that far apart
    const minGapX = 58 * u;
    const out: number[] = [];
    let lastX = -Infinity;
    for (let m = start; m <= domain.max; m += stepMin) {
      const xm = PAD_X + ((m - domain.min) / (domain.max - domain.min)) * (W - 2 * PAD_X);
      if (xm - lastX < minGapX) continue;
      out.push(m);
      lastX = xm;
    }
    return out;
  }, [domain, u]);

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
      <div className="relative w-full" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={ariaLabel}

      >
        <defs>
          <pattern id="ribbonHatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule-strong)" strokeWidth="1" opacity="0.5" />
          </pattern>
        </defs>

        {/* strip background */}
        <rect x={PAD_X} y={0} width={W - 2 * PAD_X} height={STRIP_H * u} rx={4} fill="var(--surface-2)" />

        {/* mood cells / gaps */}
        {cells.map((cell, i) =>
          cell.colour ? (
            <rect key={`c${i}`} x={cell.x} y={0} width={cell.w} height={STRIP_H * u} fill={cell.colour} />
          ) : (
            <rect key={`g${i}`} x={cell.x} y={0} width={cell.w} height={STRIP_H * u} fill="url(#ribbonHatch)" />
          ),
        )}

        {/* exact-value line */}
        {linePath ? (
          <path d={linePath} fill="none" stroke="var(--text)" strokeWidth={2 * u} opacity="0.85" />
        ) : null}

        {/* rim */}
        <rect x={PAD_X} y={0.5} width={W - 2 * PAD_X} height={STRIP_H * u} rx={4} fill="none" stroke="var(--rule)" />

        {/* stress episode flags (decorative; the HTML hotspots carry semantics) */}
        {episodes.map((marker) => {
          const m = minuteOfDay(marker.t);
          if (m < domain.min || m > domain.max) return null;
          return <path key={marker.t} d={`M${x(m) - 3.5 * u},${STRIP_H * u} l${3.5 * u},${-6 * u} ${3.5 * u},${6 * u} z`} fill="var(--stress)" aria-hidden />;
        })}

        {/* breather markers (decorative) */}
        {breathers.map((marker) => {
          const m = minuteOfDay(marker.t);
          if (m < domain.min || m > domain.max) return null;
          return <circle key={marker.t} cx={x(m)} cy={(STRIP_H - 8) * u} r={4 * u} fill="var(--surface)" stroke="var(--stress)" strokeWidth={1.5 * u} aria-hidden />;
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
                d={`M${x1},${(STRIP_H + 4) * u} v${6 * u} H${x2} v${-6 * u}`}
                fill="none"
                stroke="var(--rule-strong)"
                strokeWidth="1"
              />

            </g>
          );
        })}

        {/* now marker */}
        {nowVisible ? (
          <g>
            <line x1={x(nowMin)} y1={0} x2={x(nowMin)} y2={STRIP_H * u} stroke="var(--primary)" strokeWidth={1.5 * u} />
            <text x={x(nowMin)} y={STRIP_H * u + 24 * u} textAnchor="middle" fontSize={12 * u} fill="var(--primary)">
              Now
            </text>
          </g>
        ) : null}

        {/* axis */}
        <line x1={PAD_X} y1={STRIP_H * u + 10 * u} x2={W - PAD_X} y2={STRIP_H * u + 10 * u} stroke="var(--rule)" />
        {ticks.map((m) => {
          // the Now label owns its corner: drop a tick that would collide with it
          const nearNow = nowVisible && Math.abs(x(m) - x(nowMin)) < 34 * u;
          return (
            <g key={m}>
              <line x1={x(m)} y1={STRIP_H * u + 10 * u} x2={x(m)} y2={STRIP_H * u + 14 * u} stroke="var(--rule-strong)" strokeWidth={1} />
              {!nearNow ? (
                <text x={x(m)} y={STRIP_H * u + 26 * u} textAnchor="middle" fontSize={12 * u} fill="var(--text-subtle)" className="tnum font-mono">
                  {fmtTick(m)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-0" style={{ height: 56 }}>
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
      </div>
      {/* session-length labels live in flow below the strip — never boxed against axis text */}
      {sessions.length > 0 ? (
        <div className="relative h-5" aria-hidden>
          {sessions.map((br) => {
            const from = minuteOfDay(br.from);
            const to = minuteOfDay(br.to);
            const mid = ((x(Math.max(from, domain.min)) + x(Math.min(to, domain.max))) / 2 / W) * 100;
            return (
              <span
                key={br.from}
                className="tnum absolute top-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-caption text-text-muted"
                style={{ left: `${Math.min(78, Math.max(4, mid))}%` }}
              >
                {br.label}
              </span>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
