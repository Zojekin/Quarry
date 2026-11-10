import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const read = (name: string) =>
  JSON.parse(readFileSync(new URL("../../" + name, import.meta.url), "utf8"));
export default defineConfig({
  base: './',
  plugins: [react()],
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
