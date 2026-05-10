import { useQuery } from "@tanstack/react-query";
import type { ProjectItem, ProjectSummary, TeamMember } from "./types";

export class ApiError extends Error {
  status: number;
  resetAt?: string;
  constructor(message: string, status: number, resetAt?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.resetAt = resetAt;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiError("Could not reach the server.", 0);
  }
  let body: { error?: string; resetAt?: string } | null = null;
  try {
    body = (await res.json()) as { error?: string; resetAt?: string };
  } catch {
    // No body or not JSON — let the status carry the meaning.
  }
  if (!res.ok) {
    throw new ApiError(
      body?.error ?? `HTTP ${res.status}`,
      res.status,
      body?.resetAt,
    );
  }
  return body as T;
}

export function useProjects() {
  return useQuery<ProjectSummary[]>({
    queryKey: ["projects"],
    queryFn: () => fetchJson("/api/projects"),
  });
}

export function useItems(owner: string | null, number: number | null) {
  return useQuery<ProjectItem[]>({
    queryKey: ["items", owner, number],
    enabled: owner !== null && number !== null,
    queryFn: () => fetchJson(`/api/projects/${owner}/${number}/items`),
  });
}

export function useTeam(owner: string | null, number: number | null) {
  return useQuery<TeamMember[]>({
    queryKey: ["team", owner, number],
    enabled: owner !== null && number !== null,
    queryFn: () => fetchJson(`/api/projects/${owner}/${number}/team`),
  });
}

type Health =
  | { status: "ok"; login: string }
  | { status: "error"; message: string };

export function useHealth() {
  return useQuery<Health>({
    queryKey: ["health"],
    queryFn: () => fetchJson("/api/health"),
  });
}
