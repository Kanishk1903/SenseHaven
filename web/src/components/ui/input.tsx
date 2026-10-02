import { forwardRef } from "react";

import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-control border border-border bg-surface px-3 text-body",
        "placeholder:text-text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "aria-[invalid=true]:border-stress",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
