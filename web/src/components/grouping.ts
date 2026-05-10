import type { ProjectItem, User } from "../types";

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const STATUS_RANK: Record<string, number> = {
  "In review": 0,
  "In progress": 1,
  Ready: 2,
  Todo: 3,
  Backlog: 4,
  Done: 99,
};

function rank(item: ProjectItem, name: string, table: Record<string, number>, fallback: number): number {
  const v = item.fields[name];
  if (v?.kind !== "single_select") return fallback;
  return table[v.optionName] ?? fallback;
}

export function sortItems(a: ProjectItem, b: ProjectItem): number {
  const pa = rank(a, "Priority", PRIORITY_RANK, 99);
  const pb = rank(b, "Priority", PRIORITY_RANK, 99);
  if (pa !== pb) return pa - pb;
  const sa = rank(a, "Status", STATUS_RANK, 50);
  const sb = rank(b, "Status", STATUS_RANK, 50);
  if (sa !== sb) return sa - sb;
  return b.number - a.number;
}

export function isDone(item: ProjectItem): boolean {
  const v = item.fields.Status;
  return v?.kind === "single_select" && v.optionName === "Done";
}

export type Group = { user: User; items: ProjectItem[] };

export function groupByUser(
  items: ProjectItem[],
  getUsers: (item: ProjectItem) => User[],
): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    for (const u of getUsers(item)) {
      const g = groups.get(u.login) ?? { user: u, items: [] };
      g.items.push(item);
      groups.set(u.login, g);
    }
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, items: g.items.sort(sortItems) }))
    .sort((a, b) => b.items.length - a.items.length);
}
