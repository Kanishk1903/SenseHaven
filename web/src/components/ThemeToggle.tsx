import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/cn";
import { useTheme, type ThemePref } from "@/app/theme";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "system", label: "Follow system theme", Icon: Monitor },
  { value: "dark", label: "Dark theme", Icon: Moon },
];

/** 3-segment theme control (spec 3.4): Sun / Monitor / Moon, aria-labelled. */
export function ThemeToggle({ className }: { className?: string }) {
  const { pref, setPref } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex items-center gap-0.5 rounded-control bg-surface-3 p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => setPref(value)}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-[7px] transition-colors duration-fast lg:h-7 lg:w-8",
            pref === value
              ? "bg-surface text-text shadow-elev1"
              : "text-text-muted hover:text-text",
          )}
        >
          <Icon size={15} aria-hidden />
        </button>
      ))}
    </div>
  );
}
