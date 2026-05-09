import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pino, { type Logger } from "pino";
import pinoHttp from "pino-http";
import { createCache, type Cache } from "./cache.js";
import {
  detectRateLimit,
  describeUpstreamError,
  isUpstreamNotFound,
  upstreamNotFoundMessage,
  NotFoundError,
} from "./errors.js";
import { fetchViewerLogin } from "./github.js";
import {
  listProjects,
  getProjectItems,
  type ProjectItem,
  type ProjectSummary,
  type User,
} from "./github/projects.js";

const TTL_MS = 90_000;

export type AppDeps = {
  cache?: Cache;
  logger?: Logger;
};

export type TeamMember = User & {
  assignedCount: number;
  reviewingCount: number;
};

export function createApp(deps: AppDeps = {}) {
  const cache = deps.cache ?? createCache();
  const logger =
    deps.logger ??
    pino({ level: process.env.LOG_LEVEL ?? "info" });

  const app = express();
  app.use(cors());
  app.use(
    pinoHttp({
      logger,
      customProps: (_req, res) => ({
        cacheHit: Boolean((res as Response).locals?.cacheHit),
      }),
    }),
  );

  app.get("/api/health", asyncHandler(async (_req, res) => {
    const token = requireToken();
    const login = await fetchViewerLogin(token);
    res.json({ status: "ok", login });
  }));

  app.get("/api/projects", asyncHandler(async (req, res) => {
    const token = requireToken();
    const refresh = req.query.refresh === "1";
    const projects = await getOrFetch<ProjectSummary[]>(
      cache,
      "projects",
      refresh,
      res,
      () => listProjects(token),
    );
    res.json(projects);
  }));

  app.get("/api/projects/:owner/:number/items", asyncHandler(async (req, res) => {
    const token = requireToken();
    const owner = requireOwnerParam(req.params.owner);
    const number = parseProjectNumber(req.params.number);
    const refresh = req.query.refresh === "1";
    const items = await getOrFetch<ProjectItem[]>(
      cache,
      `items:${owner}:${number}`,
      refresh,
      res,
      () => getProjectItems(token, owner, number),
    );
    res.json(items);
  }));

  app.get("/api/projects/:owner/:number/team", asyncHandler(async (req, res) => {
    const token = requireToken();
    const owner = requireOwnerParam(req.params.owner);
    const number = parseProjectNumber(req.params.number);
    const refresh = req.query.refresh === "1";
    // Reuse the items cache so /team and /items don't both hit GitHub.
    const items = await getOrFetch<ProjectItem[]>(
      cache,
      `items:${owner}:${number}`,
      refresh,
      res,
      () => getProjectItems(token, owner, number),
    );
    res.json(deriveTeam(items));
  }));

  // Centralised error mapping.
  app.use(
    (err: unknown, req: Request, res: Response, _next: NextFunction) => {
      const rateLimit = detectRateLimit(err);
      if (rateLimit) {
        req.log.warn({ resetAt: rateLimit.resetAt }, "GitHub rate limit hit");
        res
          .status(429)
          .json({ error: "GitHub rate limit exceeded", resetAt: rateLimit.resetAt });
        return;
      }
      if (err instanceof ConfigError) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (err instanceof BadRequestError) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (isUpstreamNotFound(err)) {
        res.status(404).json({ error: upstreamNotFoundMessage(err) });
        return;
      }
      if (isStatusError(err)) {
        const status = err.status === 401 ? 401 : 502;
        req.log.error({ err }, "Upstream error");
        res.status(status).json({ error: describeUpstreamError(err) });
        return;
      }
      req.log.error({ err }, "Unhandled error");
      res.status(500).json({ error: describeUpstreamError(err) });
    },
  );

  return app;
}

// --- helpers ---

class ConfigError extends Error {}
class BadRequestError extends Error {}

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new ConfigError(
      "GITHUB_TOKEN is not set. Copy .env.example to .env and add a token.",
    );
  }
  return token;
}

function requireOwnerParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(v)) {
    throw new BadRequestError(`Invalid owner: ${v ?? "(empty)"}`);
  }
  return v;
}

function parseProjectNumber(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestError(`Invalid project number: ${v}`);
  }
  return n;
}

async function getOrFetch<T>(
  cache: Cache,
  key: string,
  refresh: boolean,
  res: Response,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!refresh) {
    const cached = cache.get<T>(key);
    if (cached !== undefined) {
      res.locals.cacheHit = true;
      return cached;
    }
  }
  const value = await fetcher();
  cache.set(key, value, TTL_MS);
  return value;
}

function deriveTeam(items: ProjectItem[]): TeamMember[] {
  const m = new Map<
    string,
    { user: User; assigned: number; reviewing: number }
  >();
  const bump = (u: User, kind: "assigned" | "reviewing") => {
    const existing = m.get(u.login) ?? { user: u, assigned: 0, reviewing: 0 };
    existing[kind] += 1;
    m.set(u.login, existing);
  };
  for (const item of items) {
    for (const u of item.assignees) bump(u, "assigned");
    for (const u of item.requestedReviewers) bump(u, "reviewing");
  }
  return Array.from(m.values())
    .map(({ user, assigned, reviewing }) => ({
      ...user,
      assignedCount: assigned,
      reviewingCount: reviewing,
    }))
    .sort(
      (a, b) =>
        b.assignedCount + b.reviewingCount - (a.assignedCount + a.reviewingCount),
    );
}

function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function isStatusError(err: unknown): err is { status?: number; message?: string } {
  return (
    !!err &&
    typeof err === "object" &&
    ("status" in err || "message" in err)
  );
}
