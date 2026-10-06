import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        islands: "./src/islands-entry.tsx",
      },
      output: {
        // react stays out of both entry chunks: home.html then loads react + home only
        manualChunks: (id) => {
          if (id.includes("node_modules") && (id.includes("/react/") || id.includes("/react-dom/") || id.includes("scheduler") || id.includes("/clsx") || id.includes("tailwind-merge"))) return "react";
          // shared primitives the public Home uses — keep them out of the app entry chunk
          const homeShared = [
            "/src/components/BrandMark", "/src/components/OrbMark", "/src/components/StatusChip",
            "/src/components/ThemeToggle", "/src/components/now/", "/src/app/theme", "/src/lib/cn",
            "/src/features/home/",
          ];
          if (homeShared.some((p) => id.includes(p))) return "home-shared";
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: false,
    exclude: ["e2e/**", "verification/**", "node_modules/**", "dist/**"],
  },
});
