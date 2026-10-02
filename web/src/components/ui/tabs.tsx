import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<HTMLDivElement, React.ComponentProps<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn("inline-flex min-h-11 items-center gap-1 rounded-control bg-surface-2 p-1 lg:min-h-10", className)}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<HTMLButtonElement, React.ComponentProps<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex min-h-11 items-center rounded-control px-3 text-secondary font-medium lg:min-h-8",
        "data-[state=active]:bg-surface data-[state=active]:text-text",
        "text-text-muted hover:text-text",
        className,
      )}
      {...props}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = TabsPrimitive.Content;
