import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils.js";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-[13.5px] font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(23,27,25,0.12),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-primary-hover hover:border-primary-hover",
        outline:
          "border-input bg-card text-foreground shadow-[0_1px_2px_rgba(23,27,25,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-muted/70 hover:border-black/20",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent/70 hover:text-foreground",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(23,27,25,0.12),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-destructive/90",
        destructiveGhost:
          "border-transparent bg-transparent text-destructive shadow-none hover:bg-[#fbeceb]",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-2.5 text-[13px]",
        lg: "h-10 px-4",
        icon: "size-8 p-0",
        iconSm: "size-7 p-0",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

export function Button({
  asChild = false,
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
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
