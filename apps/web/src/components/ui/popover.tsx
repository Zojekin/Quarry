import type { ComponentProps } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "../../lib/utils.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  collisionPadding = 12,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 min-w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-content-available-width)] rounded-lg border border-solid border-border bg-popover text-popover-foreground shadow-panel motion-safe:animate-[overlay-in_140ms_ease-out]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
