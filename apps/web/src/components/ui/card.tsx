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
        "card rounded-xl border border-solid border-border bg-card p-6 text-card-foreground shadow-surface",
        className,
      )}
      {...props}
    />
  );
}
