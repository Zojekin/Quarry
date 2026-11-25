/// <reference types="vite/client" />
interface Window {
  __QUARRY_DESKTOP__?: {
    setTitleBarOverlay?: (colors: import("./lib/themes.js").ResolvedTheme["overlay"]) => void;
    updater?: import("@quarry/shared").DesktopUpdaterBridge;
  };
}

declare const __PRODUCT__: {
  name: string;
  englishName: string;
  description: string;
  version: string;
  author: { name: string; url: string };
  links: { project: string; contact: string };
};
