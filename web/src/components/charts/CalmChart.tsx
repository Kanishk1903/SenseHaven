/** CalmChart (spec 7.8) — the premium calm-index chart shared by Overview and Analytics.
 *
 *  - Time axis with adaptive ticks in the parent's timezone + "Now" marker
 *  - Auto-zoom X-domain to the active window (first sample − 30 min → now + 15 min), with a
 *    "Full day" toggle — stops the data clustering mid-chart (fixes rough edge #2)
 *  - Y ticks aligned to thresholds, labelled Stressed / Okay / Calm on the right edge
 *  - Bands: calm/stressed at 8% alpha; stressed band gets a diagonal hatch (colour-blind safe)
 *  - 2px line + gradient area, dots at real samples only; gaps stay gaps (dashed, explained)
 *  - Crosshair tooltip snapping to the nearest sample; keyboard: focus + arrow keys step
 *  - Episode markers (coral flags) for stress episodes
 */
import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type Bucket = { t: string; value: number | null; n: number };
export type EpisodeMarker = { t: string; id: string };

type Props = {
  buckets: Bucket[];
  episodes?: EpisodeMarker[];
  /** ISO instant treated as "now" (defaults to Date.now()) */
  nowIso?: string;
  /** auto-zoom to the active window instead of the full day */
  autoZoom?: boolean;
  height?: number;
  className?: string;
  /** hide the legend + zoom toggle (compact embeds like the Overview hero) */
  compact?: boolean;
  ariaLabel?: string;
};

const PAD_LEFT = 34;
const PAD_RIGHT = 46;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;

function minuteOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Choose tick positions: every ~2h for a full day, ~30 min for tight windows. */
function chooseTicks(minM: number, maxM: number, width: number): number[] {
  const span = maxM - minM;
  const targetPx = 90;
  const stepCandidates = [15, 30, 60, 120, 180, 240];
  const stepMin = stepCandidates.find((s) => (span / s) * targetPx <= width) ?? 240;
  const start = Math.ceil(minM / stepMin) * stepMin;
  const ticks: number[] = [];
  for (let m = start; m <= maxM; m += stepMin) ticks.push(m);
  return ticks;
}

export function CalmChart({
  buckets,
  episodes = [],
  nowIso,
  autoZoom = true,
  height = 220,
  className,
  compact = false,
  ariaLabel = "Calm Index through the day",
}: Props) {
  const [fullDay, setFullDay] = useState(!autoZoom);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 800;
  const H = height;
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const nowMin = useMemo(
    () => minuteOfDay(nowIso ?? new Date().toISOString()),
    [nowIso],
  );

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
    return { min: Math.max(0, first - 30), max: Math.min(24 * 60, Math.max(last, nowMin) + 15) };
  }, [fullDay, samples, nowMin]);

  const x = useCallback(
    (minute: number) => PAD_LEFT + ((minute - domain.min) / (domain.max - domain.min)) * plotW,
    [domain, plotW],
  );
  const y = useCallback((value: number) => PAD_TOP + (1 - value / 100) * plotH, [plotH]);

  // visible samples + gap regions within the domain
  const visible = useMemo(() => samples.filter((s) => s.minute >= domain.min && s.minute <= domain.max), [samples, domain]);

  const gaps = useMemo(() => {
    if (visible.length === 0) return [];
    const regions: { from: number; to: number }[] = [];
    let cursor = domain.min;
    for (const s of visible) {
      if (s.minute - cursor > 20) regions.push({ from: cursor, to: s.minute });
      cursor = s.minute;
    }
    if (domain.max - cursor > 20 && cursor > domain.min) {
      // trailing gap only if it is before "now"
      if (cursor < nowMin) regions.push({ from: cursor, to: Math.min(domain.max, nowMin) });
    }
    return regions;
  }, [visible, domain, nowMin]);

  const path = useMemo(() => {
    if (visible.length === 0) return "";
    return visible
      .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.minute).toFixed(1)},${y(s.value).toFixed(1)}`)
      .join(" ");
  }, [visible, x, y]);

  const areaPath = useMemo(() => {
    if (visible.length === 0) return "";
    const base = PAD_TOP + plotH;
    return `${path} L${x(visible[visible.length - 1].minute).toFixed(1)},${base} L${x(visible[0].minute).toFixed(1)},${base} Z`;
  }, [visible, path, x, plotH]);

  const ticks = useMemo(() => chooseTicks(domain.min, domain.max, plotW), [domain, plotW]);
  const activeIndex = hoverIndex ?? keyboardIndex;
  const active = activeIndex !== null ? visible[activeIndex] : null;

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || visible.length === 0) return null;
      const rect = svg.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * width;
      let best = 0;
      let bestDist = Infinity;
      visible.forEach((s, i) => {
        const d = Math.abs(x(s.minute) - px);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    },
    [visible, width, x],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (visible.length === 0) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const current = keyboardIndex ?? Math.floor(visible.length / 2);
      const next = event.key === "ArrowLeft" ? current - 1 : current + 1;
      setKeyboardIndex(Math.max(0, Math.min(visible.length - 1, next)));
    }
    if (event.key === "Escape") setKeyboardIndex(null);
  };

  const nowVisible = !fullDay && nowMin >= domain.min && nowMin <= domain.max;

  return (
    <div className={className}>
      {!compact && (
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-caption text-text-subtle">
            Dashed = no readings. We never guess between samples.
          </p>
          <div className="flex items-center gap-0.5 rounded-control bg-surface-3 p-0.5 text-caption">
            <button
              type="button"
              aria-pressed={!fullDay}
              onClick={() => setFullDay(false)}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[7px] px-3 lg:min-h-6 lg:min-w-0",
                !fullDay ? "bg-surface text-text shadow-elev1" : "text-text-muted",
              )}
            >
              Active hours
            </button>
            <button
              type="button"
              aria-pressed={fullDay}
              onClick={() => setFullDay(true)}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[7px] px-3 lg:min-h-6 lg:min-w-0",
                fullDay ? "bg-surface text-text shadow-elev1" : "text-text-muted",
              )}
            >
              Full day
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${H}`}
          className="w-full"
          style={{ height }}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onMouseMove={(e) => setHoverIndex(indexFromClientX(e.clientX))}
          onMouseLeave={() => setHoverIndex(null)}
          onFocus={() => setKeyboardIndex((i) => i ?? Math.floor(visible.length / 2))}
          onBlur={() => setKeyboardIndex(null)}
        >
          <defs>
            <linearGradient id="calmArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--calm)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--calm)" stopOpacity="0" />
            </linearGradient>
            <pattern id="stressHatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--stress)" strokeWidth="1.2" opacity="0.25" />
            </pattern>
          </defs>

          {/* threshold bands */}
          <rect x={PAD_LEFT} y={PAD_TOP} width={plotW} height={plotH * 0.3} fill="var(--calm)" opacity="0.08" />
          <rect
            x={PAD_LEFT}
            y={y(35)}
            width={plotW}
            height={plotH - (y(35) - PAD_TOP)}
            fill="url(#stressHatch)"
            opacity="0.5"
          />

          {/* y gridlines + labels */}
          {[0, 35, 70, 100].map((v) => (
            <g key={v}>
              <line x1={PAD_LEFT} y1={y(v)} x2={PAD_LEFT + plotW} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
              <text x={PAD_LEFT - 6} y={y(v) + 3} textAnchor="end" fontSize="12" fill="var(--text-subtle)" className="tnum">
                {v}
              </text>
            </g>
          ))}
          <text x={PAD_LEFT + plotW + 6} y={y(85) + 3} fontSize="12" fill="var(--calm-fg)">
            Calm
          </text>
          <text x={PAD_LEFT + plotW + 6} y={y(50) + 3} fontSize="12" fill="var(--text-subtle)">
            Okay
          </text>
          <text x={PAD_LEFT + plotW + 6} y={y(15) + 3} fontSize="12" fill="var(--stress-fg)">
            Stressed
          </text>

          {/* gap regions */}
          {gaps.map((gap, i) => (
            <g key={i}>
              <rect
                x={x(gap.from)}
                y={PAD_TOP}
                width={Math.max(x(gap.to) - x(gap.from), 2)}
                height={plotH}
                fill="var(--surface-2)"
                opacity="0.55"
              />
              <line
                x1={x((gap.from + gap.to) / 2)}
                y1={PAD_TOP + 4}
                x2={x((gap.from + gap.to) / 2)}
                y2={PAD_TOP + plotH - 4}
                stroke="var(--border-strong)"
                strokeDasharray="3 4"
              />
            </g>
          ))}

          {/* area + line + dots */}
          {areaPath ? <path d={areaPath} fill="url(#calmArea)" /> : null}
          {path ? <path d={path} fill="none" stroke="var(--calm)" strokeWidth="2" strokeLinecap="round" /> : null}
          {visible.map((s) => (
            <circle key={s.t} cx={x(s.minute)} cy={y(s.value)} r={visible.length > 60 ? 2 : 3.5} fill="var(--calm)" />
          ))}

          {/* episode markers */}
          {episodes.map((e) => {
            const m = minuteOfDay(e.t);
            if (m < domain.min || m > domain.max) return null;
            return (
              <g key={e.id} aria-label="stress episode">
                <line x1={x(m)} y1={PAD_TOP + plotH - 6} x2={x(m)} y2={PAD_TOP + plotH} stroke="var(--stress)" strokeWidth="2" />
                <path
                  d={`M${x(m) - 4},${PAD_TOP + plotH - 12} h8 v6 h-8 z`}
                  fill="var(--stress)"
                />
              </g>
            );
          })}

          {/* now marker */}
          {nowVisible ? (
            <g>
              <line
                x1={x(nowMin)}
                y1={PAD_TOP}
                x2={x(nowMin)}
                y2={PAD_TOP + plotH}
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeDasharray="2 3"
              />
              <circle cx={x(nowMin)} cy={PAD_TOP + 3} r={2.5} fill="var(--primary)" />
            </g>
          ) : null}

          {/* crosshair */}
          {active ? (
            <g>
              <line x1={x(active.minute)} y1={PAD_TOP} x2={x(active.minute)} y2={PAD_TOP + plotH} stroke="var(--text-subtle)" strokeWidth="1" />
              <circle cx={x(active.minute)} cy={y(active.value)} r={4.5} fill="var(--surface)" stroke="var(--calm)" strokeWidth="2" />
            </g>
          ) : null}

          {/* x ticks */}
          {ticks.map((m) => (
            <g key={m}>
              <line x1={x(m)} y1={PAD_TOP + plotH} x2={x(m)} y2={PAD_TOP + plotH + 4} stroke="var(--border-strong)" />
              <text x={x(m)} y={PAD_TOP + plotH + 15} textAnchor="middle" fontSize="12" fill="var(--text-subtle)" className="tnum">
                {fmtTime(new Date(new Date().setHours(Math.floor(m / 60), m % 60, 0, 0)).toISOString())}
              </text>
            </g>
          ))}
        </svg>

        {/* tooltip overlay */}
        {active ? (
          <div
            className="pointer-events-none absolute z-10 rounded-control border border-border bg-surface px-2.5 py-1.5 shadow-elev2"
            style={{
              left: `${((x(active.minute) - 60) / width) * 100}%`,
              top: 0,
              minWidth: 132,
            }}
            role="status"
          >
            <p className="tnum text-caption font-medium text-text">{fmtTime(active.t)}</p>
            <p className="tnum text-secondary text-text-muted">
              Calm Index {active.value}
            </p>
          </div>
        ) : null}
      </div>

      {!compact && (
        <p aria-live="polite" className="sr-only">
          {active
            ? `${fmtTime(active.t)}: Calm Index ${active.value}`
            : `${visible.length} readings shown`}
        </p>
      )}
    </div>
  );
}
