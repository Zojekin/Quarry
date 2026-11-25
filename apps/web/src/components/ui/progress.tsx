import type { ComponentProps } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

export function Progress({
  value = 0,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className="relative mt-3 mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full rounded-full bg-primary transition-transform"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
