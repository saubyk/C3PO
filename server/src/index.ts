import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import express from "express";
import cors from "cors";
import { fetchViewerLogin } from "./github.js";

// Load .env from the repo root, regardless of which workspace runs the server.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../.env") });

const app = express();
app.use(cors());

app.get("/api/health", async (_req, res) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(500).json({
      status: "error",
      message:
        "GITHUB_TOKEN is not set. Copy .env.example to .env and add a token.",
    });
    return;
  }

  try {
    const login = await fetchViewerLogin(token);
    res.json({ status: "ok", login });
  } catch (err: unknown) {
    const message = extractGithubErrorMessage(err);
    const status = isAuthError(err) ? 401 : 502;
    res.status(status).json({ status: "error", message });
  }
});

function extractGithubErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { status?: number; message?: string };
    if (e.status === 401) {
      return "GitHub rejected the token (401). Check that GITHUB_TOKEN is valid and has the required scopes.";
    }
    if (typeof e.message === "string" && e.message.length > 0) {
      return e.message;
    }
  }
  return "Unknown error talking to GitHub.";
}

function isAuthError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { status?: number }).status === 401
  );
}

const port = Number(process.env.PORT ?? 5173);
const debug = process.env.LOG_LEVEL === "debug";
app.listen(port, () => {
  if (debug) {
    console.log(`[server] listening on http://localhost:${port}`);
  }
});
