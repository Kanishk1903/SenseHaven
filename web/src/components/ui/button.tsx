import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-hover",
        secondary: "bg-primary-soft text-primary hover:brightness-95",
        outline: "border border-border bg-surface text-text hover:bg-surface-2",
        ghost: "text-text-muted hover:bg-surface-2 hover:text-text",
        danger: "bg-stress text-on-primary hover:opacity-90",
      },
      size: {
        sm: "h-11 px-3 text-secondary lg:h-8",
        md: "h-11 px-4 text-body lg:h-10",
        lg: "h-11 px-6 text-body",
        icon: "h-11 w-11 lg:h-10 lg:w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps & { loading?: boolean }>(
  ({ className, variant, size, type = "button", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), "active:scale-[0.98]", className)}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
