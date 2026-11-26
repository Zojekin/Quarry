import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme-context.js";
import { themeModes, type ThemeMode } from "../lib/themes.js";
import { Button } from "./ui/button.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip.js";

export const themeModeLabels = {
  light: "日间",
  dark: "夜间",
  system: "跟随系统",
} satisfies Record<ThemeMode, string>;

const modeIcons = { light: Sun, dark: Moon, system: Monitor };

export function ThemeModeToggle({ compact = false }: { compact?: boolean }) {
  const { config, setConfig } = useTheme();
  const next = themeModes[(themeModes.indexOf(config.mode) + 1) % themeModes.length]!;
  const Icon = modeIcons[config.mode];
  const label = `外观模式：${themeModeLabels[config.mode]}，切换至${themeModeLabels[next]}`;
  const button = (
    <Button
      variant="ghost"
      size="iconSm"
      aria-label={label}
      title={compact ? undefined : label}
      className="quarry-no-drag"
      onClick={() => setConfig({ ...config, mode: next })}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </Button>
  );
  if (!compact) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
