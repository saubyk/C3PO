import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RepoCount } from "../types";

export type ChartMode = "counts" | "percentages";

type Props = {
  login: string;
  assigned: RepoCount[];
  reviewing: RepoCount[];
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
};

// Tailwind-aligned palette; cycled deterministically across repos so a single
// repo gets the same color in both pies (and across renders).
const PALETTE = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
];

function buildColorMap(allRepos: string[]): Map<string, string> {
  // Sort so the color assignment is stable across renders even if the
  // underlying arrays change order.
  const sorted = [...new Set(allRepos)].sort();
  const map = new Map<string, string>();
  sorted.forEach((repo, i) => {
    map.set(repo, PALETTE[i % PALETTE.length] ?? "#9ca3af");
  });
  return map;
}

export function WorkloadCharts({
  login,
  assigned,
  reviewing,
  mode,
  onModeChange,
}: Props) {
  const colorMap = useMemo(
    () =>
      buildColorMap([
        ...assigned.map((r) => r.repo),
        ...reviewing.map((r) => r.repo),
      ]),
    [assigned, reviewing],
  );

  const assignedTotal = sumCount(assigned);
  const reviewingTotal = sumCount(reviewing);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-3 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">
          Workload — <span className="font-mono">{login}</span>
        </h2>
        <span className="text-xs text-gray-500">
          {assignedTotal + reviewingTotal} open{" "}
          {assignedTotal + reviewingTotal === 1 ? "item" : "items"}
        </span>
        <span className="ml-auto inline-flex rounded border border-gray-200 overflow-hidden text-xs">
          <ToggleButton
            active={mode === "counts"}
            onClick={() => onModeChange("counts")}
            label="Counts"
          />
          <ToggleButton
            active={mode === "percentages"}
            onClick={() => onModeChange("percentages")}
            label="%"
          />
        </span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-y-auto">
        <ChartCard
          title="Assigned"
          total={assignedTotal}
          data={assigned}
          mode={mode}
          colorMap={colorMap}
          emptyMessage="No open assigned items in the configured orgs."
        />
        <ChartCard
          title="Reviewing"
          total={reviewingTotal}
          data={reviewing}
          mode={mode}
          colorMap={colorMap}
          emptyMessage="No open PRs awaiting review."
        />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  total,
  data,
  mode,
  colorMap,
  emptyMessage,
}: {
  title: string;
  total: number;
  data: RepoCount[];
  mode: ChartMode;
  colorMap: Map<string, string>;
  emptyMessage: string;
}) {
  return (
    <section className="flex flex-col border border-gray-200 rounded-md bg-white">
      <header className="px-3 py-2 border-b border-gray-100 flex items-baseline gap-2">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500 tabular-nums">({total})</span>
      </header>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-gray-500 text-center">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0">
          <div className="flex-1 min-h-[180px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="repo"
                  innerRadius="45%"
                  outerRadius="80%"
                  paddingAngle={1}
                  isAnimationActive={false}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.repo}
                      fill={colorMap.get(entry.repo) ?? "#9ca3af"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const n = typeof value === "number" ? value : Number(value);
                    const repo = String(
                      (item as { payload?: { repo?: string } })?.payload?.repo ?? "",
                    );
                    return [formatValue(n, total, mode), repo];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="text-xs space-y-1 lg:w-44 shrink-0 overflow-y-auto">
            {data.map((d) => (
              <li
                key={d.repo}
                className="flex items-center gap-2 leading-tight"
                title={d.repo}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: colorMap.get(d.repo) ?? "#9ca3af" }}
                />
                <span className="flex-1 truncate text-gray-700">
                  {shortenRepo(d.repo)}
                </span>
                <span className="tabular-nums text-gray-500 shrink-0">
                  {formatValue(d.count, total, mode)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "px-2 py-0.5",
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function sumCount(rows: RepoCount[]): number {
  let n = 0;
  for (const r of rows) n += r.count;
  return n;
}

function formatValue(value: number, total: number, mode: ChartMode): string {
  if (mode === "percentages") {
    if (total === 0) return "0%";
    return `${Math.round((value / total) * 100)}%`;
  }
  return String(value);
}

// Drop the owner segment when there's room — the legend lives next to the
// pie and `lightningnetwork/lnd` truncates ugly. The full repo is in the
// `title` attribute for hover.
function shortenRepo(full: string): string {
  const idx = full.indexOf("/");
  if (idx < 0) return full;
  return full.slice(idx + 1);
}
