import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { cn } from "@/lib/cn";

/** KPI tile with tabular numerals and an optional trend vs the previous period. */
export function Kpi({
  label,
  value,
  hint,
  trendPct,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  trendPct?: number | null;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-4", className)}>
      <p className="text-secondary text-text-subtle">{label}</p>
      <p className="tnum mt-1 font-display text-[28px] font-bold leading-9" aria-label={label}>
        {value}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-caption">
        {typeof trendPct === "number" ? (
          <>
            {trendPct > 0 ? (
              <TrendingUp size={13} aria-hidden className="text-calm-fg" />
            ) : trendPct < 0 ? (
              <TrendingDown size={13} aria-hidden className="text-stress-fg" />
            ) : (
              <Minus size={13} aria-hidden />
            )}
            <span className={trendPct >= 0 ? "text-calm-fg" : "text-stress-fg"}>
              {trendPct > 0 ? "+" : ""}
              {trendPct}%
            </span>
            <span className="text-text-subtle">vs last period</span>
          </>
        ) : (
          hint && <span className="text-text-subtle">{hint}</span>
        )}
      </div>
    </div>
  );
}
