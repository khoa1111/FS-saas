import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // `npm run dev:ui` proxies to `wrangler dev` (default port 8787)
    proxy: {
      "/api": "http://localhost:8787",
      "/ws": { target: "ws://localhost:8787", ws: true }
    }
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1600
  }
});
