import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const debug = process.env.LOG_LEVEL === "debug";
const apiTarget = `http://localhost:${process.env.PORT ?? 5173}`;
const appPort = 3263;

function readyBanner(): Plugin {
  return {
    name: "c3po-ready-banner",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        setImmediate(() => {
          console.log(
            `\n  ➜  Open http://localhost:${appPort} in your browser\n`,
          );
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), readyBanner()],
  logLevel: debug ? "info" : "warn",
  server: {
    port: appPort,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
