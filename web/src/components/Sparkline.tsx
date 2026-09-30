import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

/** Minimal sparkline for the calm-index trend inside cards. Gaps stay gaps. */
export function Sparkline({ points, height = 40 }: { points: (number | null)[]; height?: number }) {
  const data = points.map((value, index) => ({ index, value }));
  return (
    <div style={{ height }} role="img" aria-label="Calm index trend for the last 30 minutes">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis domain={[0, 100]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--calm)"
            strokeWidth={2}
            fill="var(--calm-soft)"
            connectNulls={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
