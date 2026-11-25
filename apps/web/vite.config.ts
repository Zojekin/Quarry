import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
const read = (name: string) =>
  JSON.parse(readFileSync(new URL("../../" + name, import.meta.url), "utf8"));

function inlineTheme(): Plugin {
  return {
    name: "quarry-theme-boot",
    transformIndexHtml: {
      order: "post",
      async handler(html) {
        // A classic script works before the first paint, including Electron loadFile.
        const source = readFileSync(new URL("./src/lib/themes.ts", import.meta.url), "utf8");
        const { code } = await transformWithEsbuild(source + "\nbootTheme(window);", "themes.ts", {
          format: "iife",
          minify: true,
          target: "es2022",
        });
        return html.replace("<!-- quarry-theme-boot -->", () => `<script>${code}</script>`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), inlineTheme()],
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Zod 4.6 ships misplaced tree-shaking comments; Rollup safely discards them.
        if (
          warning.code === "INVALID_ANNOTATION" &&
          warning.id?.includes("/zod/")
        )
          return;
        defaultHandler(warning);
      },
    },
  },
  define: {
    __PRODUCT__: JSON.stringify({
      ...read("product-info.json"),
      version: read("package.json").version,
    }),
  },
});
