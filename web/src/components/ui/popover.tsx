import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverContent = forwardRef<HTMLDivElement, React.ComponentProps<typeof PopoverPrimitive.Content>>(
  ({ className, align = "end", sideOffset = 6, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-card border border-border bg-surface p-4 shadow-elev2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  ),
);
PopoverContent.displayName = "PopoverContent";
