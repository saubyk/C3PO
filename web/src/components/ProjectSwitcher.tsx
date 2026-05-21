import type { ProjectSummary } from "../types";

export type ActiveProject = { owner: string; number: number };

type Props = {
  projects: ProjectSummary[] | undefined;
  active: ActiveProject | null;
  onChange: (next: ActiveProject | null) => void;
};

export function ProjectSwitcher({ projects, active, onChange }: Props) {
  const grouped = groupByOwner(projects ?? []);
  const activeKey = active ? `${active.owner}:${active.number}` : "";

  return (
    <select
      aria-label="Active project"
      value={activeKey}
      disabled={!projects}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) {
          onChange(null);
          return;
        }
        const [owner, num] = v.split(":");
        if (!owner || !num) return;
        onChange({ owner, number: Number(num) });
      }}
      className="text-sm border border-line rounded px-2 py-1 bg-panel2 text-fg focus:outline-none focus:ring-1 focus:ring-accent max-w-xs disabled:opacity-50"
    >
      <option value="">
        {projects ? "Pick a project…" : "Loading projects…"}
      </option>
      {grouped.map(([owner, list]) => (
        <optgroup key={owner} label={owner}>
          {list.map((p) => (
            <option
              key={`${p.owner}:${p.number}`}
              value={`${p.owner}:${p.number}`}
            >
              {p.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function groupByOwner(
  projects: ProjectSummary[],
): Array<[string, ProjectSummary[]]> {
  const m = new Map<string, ProjectSummary[]>();
  for (const p of projects) {
    const arr = m.get(p.owner) ?? [];
    arr.push(p);
    m.set(p.owner, arr);
  }
  return Array.from(m.entries())
    .map(
      ([owner, list]) =>
        [owner, list.sort((a, b) => a.title.localeCompare(b.title))] as [
          string,
          ProjectSummary[],
        ],
    )
    .sort(([a], [b]) => a.localeCompare(b));
}
