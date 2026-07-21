import type { ProjectItem, TeamMember, User } from "../types";

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const STATUS_RANK: Record<string, number> = {
  "In review": 0,
  "In progress": 1,
  Ready: 2,
  Todo: 3,
  Backlog: 4,
  Done: 99,
};

function rank(
  item: ProjectItem,
  name: string,
  table: Record<string, number>,
  fallback: number,
): number {
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

export function singleSelect(item: ProjectItem, name: string): string | null {
  const v = item.fields[name];
  return v?.kind === "single_select" ? v.optionName : null;
}

// --- filters ---

export const HIDE_DONE = "Hide Done";
export const ALL = "All";

export function passesStatus(item: ProjectItem, filter: string): boolean {
  const status = singleSelect(item, "Status");
  if (filter === ALL) return true;
  if (filter === HIDE_DONE) return !/\bdone\b/i.test(status ?? "");
  return status === filter;
}

export function passesPriority(item: ProjectItem, filter: string): boolean {
  if (filter === ALL) return true;
  return singleSelect(item, "Priority") === filter;
}

export function passesSearch(item: ProjectItem, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) || String(item.number).includes(q)
  );
}

export function statusOptions(items: ProjectItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const v = singleSelect(item, "Status");
    if (v) set.add(v);
  }
  return [ALL, HIDE_DONE, ...Array.from(set).sort()];
}

export function priorityOptions(items: ProjectItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const v = singleSelect(item, "Priority");
    if (v) set.add(v);
  }
  return [
    ALL,
    ...Array.from(set).sort((a, b) =>
      (PRIORITY_RANK[a] ?? 99) - (PRIORITY_RANK[b] ?? 99),
    ),
  ];
}

// --- grouping + team derivation ---

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

// Priority bands used when a single assignee is selected: both columns
// regroup by priority instead of person. Unknown/missing priority → "none".
export type PriorityBand = {
  key: string;
  label: string;
  badge: string;
  color: string;
};

export const PRIORITY_BANDS: PriorityBand[] = [
  { key: "P0", label: "P0 · CRITICAL", badge: "P0", color: "var(--color-red)" },
  { key: "P1", label: "P1 · HIGH", badge: "P1", color: "var(--color-amber)" },
  { key: "P2", label: "P2 · ROUTINE", badge: "P2", color: "var(--color-prio2)" },
  { key: "P3", label: "P3 · LOW", badge: "P3", color: "var(--color-prio3)" },
  {
    key: "none",
    label: "UNPRIORITIZED",
    badge: "·",
    color: "var(--color-prio-none)",
  },
];

export type PriorityGroup = { band: PriorityBand; items: ProjectItem[] };

export function groupByPriority(items: ProjectItem[]): PriorityGroup[] {
  const buckets = new Map<string, ProjectItem[]>();
  for (const item of items) {
    const p = singleSelect(item, "Priority");
    const key = p && PRIORITY_RANK[p] !== undefined ? p : "none";
    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }
  return PRIORITY_BANDS.flatMap((band) => {
    const bucket = buckets.get(band.key);
    if (!bucket || bucket.length === 0) return [];
    return [{ band, items: bucket.sort(sortItems) }];
  });
}

// Derive team list + counts client-side from the (already filtered) items so
// the badge in the assignee list always matches what the columns show.
export function deriveTeam(items: ProjectItem[]): TeamMember[] {
  const m = new Map<
    string,
    { user: User; assigned: number; reviewing: number }
  >();
  const bump = (u: User, kind: "assigned" | "reviewing") => {
    const entry = m.get(u.login) ?? { user: u, assigned: 0, reviewing: 0 };
    entry[kind] += 1;
    m.set(u.login, entry);
  };
  for (const item of items) {
    for (const u of item.assignees) bump(u, "assigned");
    if (item.contentType === "PullRequest") {
      for (const u of item.reviewers) bump(u, "reviewing");
    }
  }
  return Array.from(m.values())
    .map(({ user, assigned, reviewing }) => ({
      ...user,
      assignedCount: assigned,
      reviewingCount: reviewing,
    }))
    .sort(
      (a, b) =>
        b.assignedCount + b.reviewingCount -
        (a.assignedCount + a.reviewingCount),
    );
}
