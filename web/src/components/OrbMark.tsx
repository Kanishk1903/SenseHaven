/** The mood orb — SenseHeaven's brand motif (File 02 §1). Pure SVG, no assets. */
export function OrbMark({ size = 40, mood = "calm" }: { size?: number; mood?: "calm" | "neutral" | "stress" }) {
  const stops: Record<string, [string, string]> = {
    calm: ["#7FCFB0", "#2F8F6B"],
    neutral: ["#E0A94A", "#C58A1B"],
    stress: ["#F0805F", "#D4532F"],
  };
  const [from, to] = stops[mood];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="SenseHeaven orb">
      <defs>
        <radialGradient id={`orb-${mood}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill={`url(#orb-${mood})`} />
      <circle cx="17" cy="16" r="6" fill="#FFFFFF" opacity="0.35" />
    </svg>
  );
}
