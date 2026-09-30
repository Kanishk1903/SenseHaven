import { AlertTriangle, CheckCircle2, CircleSlash, Info, PauseCircle, PlayCircle } from "lucide-react";

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

const KIND_STYLES: Record<StatusKind, { soft: string; fg: string; Icon: typeof Info }> = {
  active: { soft: "bg-calm-soft", fg: "text-calm-fg", Icon: PlayCircle },
  cooldown: { soft: "bg-neutral-soft", fg: "text-neutral-fg", Icon: PauseCircle },
  locked: { soft: "bg-surface-2", fg: "text-text-muted", Icon: CircleSlash },
  offline: { soft: "bg-neutral-soft", fg: "text-neutral-fg", Icon: AlertTriangle },
  unpaired: { soft: "bg-surface-2", fg: "text-text-muted", Icon: Info },
  calm: { soft: "bg-calm-soft", fg: "text-calm-fg", Icon: CheckCircle2 },
  neutral: { soft: "bg-surface-2", fg: "text-text-muted", Icon: Info },
  stressed: { soft: "bg-stress-soft", fg: "text-stress-fg", Icon: AlertTriangle },
};

/** Status = icon + text + colour — never colour alone (File 02 principle 4). */
export function StatusChip({ kind, label, className }: { kind: StatusKind; label?: string; className?: string }) {
  const { soft, fg, Icon } = KIND_STYLES[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-medium",
        soft,
        fg,
        className,
      )}
    >
      <Icon size={14} aria-hidden />
      {label ?? KIND_LABELS[kind]}
    </span>
  );
}
