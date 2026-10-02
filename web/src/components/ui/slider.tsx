import * as SliderPrimitive from "@radix-ui/react-slider";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

/** Dual-handle range slider (sensitivity thresholds) or single handle. */
export const Slider = forwardRef<HTMLDivElement, React.ComponentProps<typeof SliderPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-pill bg-surface-2">
        <SliderPrimitive.Range className="absolute h-full bg-primary-soft" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? []).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={props["aria-label"] ? `${props["aria-label"]} ${index + 1}` : `Handle ${index + 1}`}
          className="block h-11 w-11 rounded-pill border-2 border-primary bg-surface shadow-elev1 lg:h-6 lg:w-6"
        />
      ))}
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = "Slider";
