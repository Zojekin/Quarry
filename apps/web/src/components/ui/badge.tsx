import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 text-ui-sm font-medium text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
