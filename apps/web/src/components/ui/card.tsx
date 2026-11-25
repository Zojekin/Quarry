import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

export function Card({
  as: Component = "div",
  className,
  ...props
}: ComponentProps<"div"> & { as?: "div" | "article" | "aside" | "section" }) {
  return (
    <Component
      data-slot="card"
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_3px_rgba(23,27,25,0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-2", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("m-0 text-[15px] font-semibold tracking-[-0.01em] text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("m-0 mt-0.5 text-[13px] text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 pb-4", className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
