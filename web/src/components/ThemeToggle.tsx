
import { cn } from "@/lib/cn";
import { useTheme, type ThemePref } from "@/app/theme";

const ICONS: Record<string, string> = {
  light: "M12 4V2 M12 22v-2 M4 12H2 M22 12h-2 M5.6 5.6l-1.4-1.4 M19.8 19.8l-1.4-1.4 M5.6 18.4l-1.4 1.4 M19.8 4.2l-1.4 1.4 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  system: "M4 5h16v11H4z M9 20h6 M12 16v4",
  dark: "M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9z",
};
const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: "light", label: "Light theme", icon: ICONS.light },
  { value: "system", label: "Follow system theme", icon: ICONS.system },
  { value: "dark", label: "Dark theme", icon: ICONS.dark },
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
      {OPTIONS.map(({ value, label, icon }) => (
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
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon} /></svg>
        </button>
      ))}
    </div>
  );
}
