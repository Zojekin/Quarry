import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1.5 text-[13.5px] text-foreground shadow-[0_1px_2px_rgba(var(--shadow-ink),0.03)] transition-[border-color,box-shadow] placeholder:text-muted-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 resize-y rounded-md border border-input bg-card px-3 py-2 text-[13.5px] leading-relaxed text-foreground shadow-[0_1px_2px_rgba(var(--shadow-ink),0.03)] transition-[border-color,box-shadow] placeholder:text-muted-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
