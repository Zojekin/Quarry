import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-xl border border-solid border-border bg-card"
    >
      <table
        data-slot="table"
        className={cn("data-table w-full text-left text-ui-sm", className)}
        {...props}
      />
    </div>
  );
}
