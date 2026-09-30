/** Circular progress ring for remaining screen time (Fraunces-free lean: Inter, tabular). */
export function Ring({
  fraction,
  label,
  sub,
  size = 128,
}: {
  fraction: number; // 0..1
  label: string;
  sub?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </svg>
      <div className="absolute text-center">
        <p className="tnum text-h2 font-semibold" aria-label={label}>
          {label}
        </p>
        {sub ? <p className="text-caption text-text-subtle">{sub}</p> : null}
      </div>
    </div>
  );
}
