import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CircleDot, GitPullRequest, X } from "lucide-react";
import type { WorkloadItem } from "../types";

export type ChartMode = "counts" | "percentages";

type Kind = "assigned" | "reviewing";
type Selection = { kind: Kind; repo: string } | null;
type RepoCount = { repo: string; count: number };

type Props = {
  login: string;
  assigned: WorkloadItem[];
  reviewing: WorkloadItem[];
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
  const sorted = [...new Set(allRepos)].sort();
  const map = new Map<string, string>();
  sorted.forEach((repo, i) => {
    map.set(repo, PALETTE[i % PALETTE.length] ?? "#9ca3af");
  });
  return map;
}

function countByRepo(items: WorkloadItem[]): RepoCount[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.repo, (m.get(it.repo) ?? 0) + 1);
  return Array.from(m, ([repo, count]) => ({ repo, count })).sort(
    (a, b) => b.count - a.count || a.repo.localeCompare(b.repo),
  );
}

export function WorkloadCharts({
  login,
  assigned,
  reviewing,
  mode,
  onModeChange,
}: Props) {
  const [selection, setSelection] = useState<Selection>(null);

  // Reset slice selection whenever the developer changes — a stale selection
  // from a previous login isn't meaningful in the new dataset.
  useEffect(() => {
    setSelection(null);
  }, [login]);

  const assignedCounts = useMemo(() => countByRepo(assigned), [assigned]);
  const reviewingCounts = useMemo(() => countByRepo(reviewing), [reviewing]);

  const colorMap = useMemo(
    () =>
      buildColorMap([
        ...assignedCounts.map((r) => r.repo),
        ...reviewingCounts.map((r) => r.repo),
      ]),
    [assignedCounts, reviewingCounts],
  );

  const assignedTotal = sumCount(assignedCounts);
  const reviewingTotal = sumCount(reviewingCounts);

  const handleSelect = (kind: Kind, repo: string) => {
    setSelection((prev) =>
      prev && prev.kind === kind && prev.repo === repo
        ? null
        : { kind, repo },
    );
  };

  const drillItems = useMemo(() => {
    if (!selection) return [];
    const src = selection.kind === "assigned" ? assigned : reviewing;
    return src.filter((it) => it.repo === selection.repo);
  }, [selection, assigned, reviewing]);

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
          kind="assigned"
          title="Assigned"
          total={assignedTotal}
          data={assignedCounts}
          mode={mode}
          colorMap={colorMap}
          selection={selection}
          onSelect={handleSelect}
          emptyMessage="No open assigned items in the configured orgs."
        />
        <ChartCard
          kind="reviewing"
          title="Reviewing"
          total={reviewingTotal}
          data={reviewingCounts}
          mode={mode}
          colorMap={colorMap}
          selection={selection}
          onSelect={handleSelect}
          emptyMessage="No open PRs awaiting review."
        />
      </div>

      {selection && (
        <DrillDownPanel
          kind={selection.kind}
          repo={selection.repo}
          color={colorMap.get(selection.repo) ?? "#9ca3af"}
          items={drillItems}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}

function ChartCard({
  kind,
  title,
  total,
  data,
  mode,
  colorMap,
  selection,
  onSelect,
  emptyMessage,
}: {
  kind: Kind;
  title: string;
  total: number;
  data: RepoCount[];
  mode: ChartMode;
  colorMap: Map<string, string>;
  selection: Selection;
  onSelect: (kind: Kind, repo: string) => void;
  emptyMessage: string;
}) {
  const selectedRepoHere =
    selection && selection.kind === kind ? selection.repo : null;
  const somethingSelected = selection !== null;

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
                  onClick={(payload: unknown) => {
                    const repo = (payload as { payload?: { repo?: string } })
                      ?.payload?.repo;
                    if (repo) onSelect(kind, repo);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {data.map((entry) => {
                    const isSelected = entry.repo === selectedRepoHere;
                    const dim = somethingSelected && !isSelected;
                    return (
                      <Cell
                        key={entry.repo}
                        fill={colorMap.get(entry.repo) ?? "#9ca3af"}
                        fillOpacity={dim ? 0.35 : 1}
                        stroke={isSelected ? "#111827" : "#fff"}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                    );
                  })}
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
            {data.map((d) => {
              const isSelected = d.repo === selectedRepoHere;
              return (
                <li key={d.repo}>
                  <button
                    type="button"
                    onClick={() => onSelect(kind, d.repo)}
                    aria-pressed={isSelected}
                    title={d.repo}
                    className={[
                      "w-full flex items-center gap-2 leading-tight px-1 py-0.5 rounded text-left",
                      isSelected
                        ? "bg-gray-100 ring-1 ring-gray-300"
                        : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: colorMap.get(d.repo) ?? "#9ca3af",
                      }}
                    />
                    <span className="flex-1 truncate text-gray-700">
                      {shortenRepo(d.repo)}
                    </span>
                    <span className="tabular-nums text-gray-500 shrink-0">
                      {formatValue(d.count, total, mode)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function DrillDownPanel({
  kind,
  repo,
  color,
  items,
  onClose,
}: {
  kind: Kind;
  repo: string;
  color: string;
  items: WorkloadItem[];
  onClose: () => void;
}) {
  const kindLabel = kind === "assigned" ? "Assigned" : "Reviewing";
  return (
    <div className="shrink-0 max-h-[45%] min-h-[160px] border-t border-gray-200 bg-gray-50 flex flex-col">
      <header className="px-3 py-2 flex items-center gap-2 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium text-gray-900 font-mono truncate">
          {repo}
        </span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-700">{kindLabel}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs tabular-nums text-gray-600">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drill-down list"
          className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
        >
          <X size={12} />
          Close
        </button>
      </header>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4 text-xs text-gray-500">
          No items.
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-200">
          {items.map((item) => (
            <li key={`${item.repo}#${item.number}`}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-xs leading-snug hover:bg-white"
              >
                {item.kind === "PullRequest" ? (
                  <GitPullRequest
                    size={12}
                    className="text-emerald-600 shrink-0"
                    aria-label="Pull request"
                  />
                ) : (
                  <CircleDot
                    size={12}
                    className="text-blue-600 shrink-0"
                    aria-label="Issue"
                  />
                )}
                <span className="font-mono text-gray-500 shrink-0">
                  {shortenRepo(item.repo)}#{item.number}
                </span>
                <span className="text-gray-800 truncate">{item.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
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
