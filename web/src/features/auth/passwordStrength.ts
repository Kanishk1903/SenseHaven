export type StrengthLevel = { score: 0 | 1 | 2 | 3; label: string; className: string };

/** Simple, honest strength meter: length + character variety. */
export function passwordStrength(password: string): StrengthLevel {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score += 1;
  const levels: StrengthLevel[] = [
    { score: 0, label: "Too short", className: "bg-stress-soft text-stress-fg" },
    { score: 1, label: "Weak", className: "bg-stress-soft text-stress-fg" },
    { score: 2, label: "Okay", className: "bg-neutral-soft text-neutral-fg" },
    { score: 3, label: "Strong", className: "bg-calm-soft text-calm-fg" },
  ];
  return levels[Math.min(score, 3)];
}
