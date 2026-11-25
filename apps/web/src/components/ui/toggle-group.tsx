import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { buttonVariants } from "./button.js";

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      className="tabs segmented"
      aria-label={label}
    >
      {options.map(([key, name]) => (
        <ToggleGroup.Item
          key={key}
          value={key}
          className={buttonVariants({
            variant: "ghost",
            size: "compact",
            className: "tab",
          })}
        >
          {name}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
