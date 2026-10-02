/** The orb — the single brand motif (spec 3.3). Crafted SVG, not a gradient blob:
 *  1px rim, two-stop radial state fill, offset highlight, contact shadow.
 *  Breathes (scale 1 → 1.03, 6s) only when calm and reduced motion is off. */
export type OrbState = "calm" | "neutral" | "stressed" | "offline";

const FILLS: Record<OrbState, [string, string]> = {
  calm: ["#3CCB9B", "#1F9D74"],
  neutral: ["#F0B64A", "#D99A1E"],
  stressed: ["#FF7A5C", "#E0553A"],
  offline: ["#B8B4A8", "#8A867C"],
};

export function OrbMark({
  size = 40,
  state = "calm",
  breathe = false,
  className,
}: {
  size?: number;
  state?: OrbState;
  breathe?: boolean;
  className?: string;
}) {
  const [from, to] = FILLS[state];
  const id = `orb-${state}-${size}`;
  const animated = breathe && state === "calm";
  return (
    <span
      className={cn("relative inline-block", animated && "orb-breathe", className)}
      style={{ width: size, height: size + Math.round(size * 0.08) }}
      role="img"
      aria-label={`Mood orb: ${state}`}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" className="relative z-10">
        <defs>
          <radialGradient id={id} cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="20" fill={`url(#${id})`} stroke="var(--rule-strong)" strokeWidth="1" />
        <ellipse cx="17" cy="15" rx="7.5" ry="5.5" fill="#FFFFFF" opacity="0.3" />
      </svg>
      <span
        aria-hidden
        className="absolute left-1/2 z-0 -translate-x-1/2 rounded-[50%] bg-black/15 blur-[1px]"
        style={{ width: size * 0.7, height: size * 0.1, top: size - 2 }}
      />
    </span>
  );
}

import { cn } from "@/lib/cn";
