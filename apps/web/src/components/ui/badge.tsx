import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

export const badgeVariants = cva(
  "inline-flex h-5.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium leading-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-input bg-card text-foreground",
        info: "border-transparent bg-[var(--info-bg)] text-[var(--info-fg)]",
        success: "border-transparent bg-[var(--success-bg)] text-[var(--success-fg)]",
        warning: "border-transparent bg-[var(--warning-bg)] text-[var(--warning-fg)]",
        destructive: "border-transparent bg-[var(--error-bg)] text-[var(--error-fg)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
