import { cn } from "@/lib/cn";

export type StatusKind = "active" | "cooldown" | "locked" | "offline" | "unpaired" | "calm" | "neutral" | "stressed";

const KIND_LABELS: Record<StatusKind, string> = {
  active: "Screen time active",
  cooldown: "Cooldown",
  locked: "Locked",
  offline: "Offline",
  unpaired: "No device paired",
  calm: "Calm",
  neutral: "Neutral",
  stressed: "Stressed",
};

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const ICON_PATHS = {
  play: "M7 5v14l12-7z M7 5v14",
  pause: "M9 5v14 M15 5v14",
  slash: "M12 3a9 9 0 1 0 9 9 M3 3l18 18",
  alert: "M12 4l9 16H3z M12 11v4 M12 18h.01",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v5 M12 8h.01",
  check: "M4 12l5 5L20 7",
};

const KIND_STYLES: Record<StatusKind, { soft: string; fg: string; icon: string }> = {
  active: { soft: "bg-calm-soft", fg: "text-calm-fg", icon: ICON_PATHS.play },
  cooldown: { soft: "bg-neutral-soft", fg: "text-neutral-fg", icon: ICON_PATHS.pause },
  locked: { soft: "bg-surface-2", fg: "text-text-muted", icon: ICON_PATHS.slash },
  offline: { soft: "bg-neutral-soft", fg: "text-neutral-fg", icon: ICON_PATHS.alert },
  unpaired: { soft: "bg-surface-2", fg: "text-text-muted", icon: ICON_PATHS.info },
  calm: { soft: "bg-calm-soft", fg: "text-calm-fg", icon: ICON_PATHS.check },
  neutral: { soft: "bg-surface-2", fg: "text-text-muted", icon: ICON_PATHS.info },
  stressed: { soft: "bg-stress-soft", fg: "text-stress-fg", icon: ICON_PATHS.alert },
};

/** Status = icon + text + colour — never colour alone (File 02 principle 4). */
export function StatusChip({ kind, label, className }: { kind: StatusKind; label?: string; className?: string }) {
  const { soft, fg, icon } = KIND_STYLES[kind];
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-pill border px-2.5 text-caption font-medium",
        soft,
        fg,
        className,
      )}
      style={{ borderColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
    >
      <Icon d={icon} />
      {label ?? KIND_LABELS[kind]}
    </span>
  );
}
