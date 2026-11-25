import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the in-browser Python (WebAssembly) start; it does not allow eval() of JS.
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  // data: lets pop-up images uploaded in the browser-only demo show.
  "img-src 'self' data: blob:",
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
    // The Python worker loads Pyodide with a dynamic import, which needs ES-module workers.
    worker: { format: "es" as const },
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
