import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createApp } from "./app.js";

// Load .env from the repo root, regardless of which workspace runs the server.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../.env") });

const app = createApp();
const port = Number(process.env.PORT ?? 5173);
const debug = process.env.LOG_LEVEL === "debug";

app.listen(port, () => {
  if (debug) {
    console.log(`[server] listening on http://localhost:${port}`);
  }
});
