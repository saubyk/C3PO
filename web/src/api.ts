import { useQuery } from "@tanstack/react-query";
import type { ProjectItem, TeamMember } from "./types";

// Hardcoded for M4. The project switcher arrives in M6.
export const ACTIVE_PROJECT = {
  owner: "lightningnetwork",
  number: 19,
} as const;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // Ignore JSON parse errors and fall back to the status line.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export function useItems(owner: string, number: number) {
  return useQuery<ProjectItem[]>({
    queryKey: ["items", owner, number],
    queryFn: () => fetchJson(`/api/projects/${owner}/${number}/items`),
  });
}

export function useTeam(owner: string, number: number) {
  return useQuery<TeamMember[]>({
    queryKey: ["team", owner, number],
    queryFn: () => fetchJson(`/api/projects/${owner}/${number}/team`),
  });
}

type Health = { status: "ok"; login: string } | { status: "error"; message: string };

export function useHealth() {
  return useQuery<Health>({
    queryKey: ["health"],
    queryFn: () => fetchJson("/api/health"),
  });
}
