export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export function isUpstreamNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { errors?: Array<{ type?: string }> };
  return e.errors?.some((x) => x?.type === "NOT_FOUND") ?? false;
}

export function upstreamNotFoundMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Not found.";
  const e = err as { errors?: Array<{ type?: string; message?: string }> };
  const m = e.errors?.find((x) => x?.type === "NOT_FOUND")?.message;
  return m ?? "Not found.";
}

export type RateLimitInfo = { resetAt: string };

export function detectRateLimit(err: unknown): RateLimitInfo | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    status?: number;
    errors?: Array<{ type?: string; message?: string }>;
    headers?: Record<string, string | undefined>;
    response?: { headers?: Record<string, string | undefined> };
    message?: string;
  };

  const headers = e.headers ?? e.response?.headers ?? {};
  const remaining = headers["x-ratelimit-remaining"];
  const reset = headers["x-ratelimit-reset"];
  const graphqlType = e.errors?.[0]?.type;

  const looksRateLimited =
    graphqlType === "RATE_LIMITED" ||
    (remaining === "0" && !!reset) ||
    (e.status === 403 &&
      typeof e.message === "string" &&
      /rate limit/i.test(e.message));

  if (!looksRateLimited) return null;

  const ts = reset != null ? Number(reset) : NaN;
  const resetAt = Number.isFinite(ts)
    ? new Date(ts * 1000).toISOString()
    : new Date(Date.now() + 60_000).toISOString();
  return { resetAt };
}

export function describeUpstreamError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; status?: number };
    if (e.status === 401) {
      return "GitHub rejected the token (401). Check that GITHUB_TOKEN is valid and has the required scopes.";
    }
    if (typeof e.message === "string" && e.message.length > 0) {
      return e.message;
    }
  }
  return "Unknown error talking to GitHub.";
}
