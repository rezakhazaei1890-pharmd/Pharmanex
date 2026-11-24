
import { defineConfig } from "vite";

export default defineConfig({
  base: "/Pharmanex/version2/",
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
