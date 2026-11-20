import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

/** Injects the Content-Security-Policy meta tag into the built index.html only (dev needs inline HMR scripts). */
function cspPlugin(): Plugin {
  return {
    name: "doomsday-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<!--CSP-->",
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = process.env.BASE_PATH || env.BASE_PATH || "./";
  return {
    base,
    plugins: [react(), cspPlugin()],
    build: {
      sourcemap: false,
      outDir: "dist",
      chunkSizeWarningLimit: 900,
    },
    server: {
      proxy: {
        "/api": "http://localhost:8787",
      },
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      testTimeout: 60000,
      hookTimeout: 60000,
    },
  };
});
