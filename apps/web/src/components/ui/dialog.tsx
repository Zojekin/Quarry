import type { ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-xs motion-safe:animate-[overlay-in_140ms_ease-out]"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-1/2 rounded-xl border border-solid border-border bg-card text-card-foreground shadow-panel outline-none motion-safe:animate-[overlay-in_140ms_ease-out]",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
