import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const PRESETS_MIN = [15, 30, 60, 120];

/** Duration chips + custom minutes input (session start / add time). */
export function DurationPicker({
  valueMin,
  onChange,
  className,
  presets = PRESETS_MIN,
  max = 480,
  min = 5,
  allowCustom = true,
}: {
  valueMin: number | null;
  onChange: (minutes: number | null) => void;
  className?: string;
  presets?: number[];
  max?: number;
  min?: number;
  allowCustom?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {presets.map((preset) => (
        <Button
          key={preset}
          size="sm"
          variant={valueMin === preset ? "primary" : "outline"}
          aria-pressed={valueMin === preset}
          onClick={() => onChange(preset)}
          className="tnum"
        >
          {preset < 60 ? `${preset} min` : `${preset / 60} h`}
        </Button>
      ))}
      {allowCustom ? (
        <label className="flex items-center gap-1 text-caption text-text-subtle">
          Custom
          <Input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            className="h-8 w-20 tnum"
            value={valueMin !== null && !presets.includes(valueMin) ? valueMin : ""}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange(Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : null);
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
