import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils.js";

export const buttonVariants = cva(
  "button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-solid text-ui font-medium leading-[1.4] transition-colors disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover",
        outline: "border-border bg-card text-card-foreground hover:bg-muted",
        ghost: "border-transparent bg-transparent text-primary hover:bg-accent",
      },
      size: {
        default: "h-[var(--control-height)] px-4",
        compact: "h-[var(--control-compact)] px-3 text-ui-sm",
        icon: "size-[var(--control-compact)] p-0 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

export function Button({
  asChild,
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      data-variant={variant ?? "outline"}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
