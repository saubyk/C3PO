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

// Dark-friendly palette (Tailwind 400 shades) cycled deterministically across
// repos so a single repo gets the same color in both pies and across renders.
const PALETTE = [
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
  "#a78bfa", // violet-400
  "#22d3ee", // cyan-400
  "#a3e635", // lime-400
  "#f472b6", // pink-400
  "#fb923c", // orange-400
  "#2dd4bf", // teal-400
];

function buildColorMap(allRepos: string[]): Map<string, string> {
  const sorted = [...new Set(allRepos)].sort();
  const map = new Map<string, string>();
  sorted.forEach((repo, i) => {
    map.set(repo, PALETTE[i % PALETTE.length] ?? "#94a3b8");
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
      <div className="px-4 py-2 border-b border-line bg-panel hud-scanlines flex items-center gap-3 shrink-0">
        <h2 className="text-sm font-semibold">
          <span className="uppercase tracking-widest text-accent">Workload</span>{" "}
          <span className="text-muted">—</span>{" "}
          <span className="font-mono text-fg">{login}</span>
        </h2>
        <span className="text-xs text-muted">
          {assignedTotal + reviewingTotal} open{" "}
          {assignedTotal + reviewingTotal === 1 ? "item" : "items"}
        </span>
        <span className="ml-auto inline-flex rounded border border-line overflow-hidden text-xs">
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
          color={colorMap.get(selection.repo) ?? "#94a3b8"}
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
    <section className="relative flex flex-col border border-line bg-panel">
      <CornerBrackets />
      <header className="px-3 py-2 border-b border-line bg-panel hud-scanlines flex items-baseline gap-2">
        <h3 className="text-xs font-medium uppercase tracking-widest text-accent">
          {title}
        </h3>
        <span className="text-xs text-muted tabular-nums">({total})</span>
      </header>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-muted text-center">
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
                        fill={colorMap.get(entry.repo) ?? "#94a3b8"}
                        fillOpacity={dim ? 0.35 : 1}
                        stroke={isSelected ? "#e5e7eb" : "#0f1424"}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#131a2e",
                    border: "1px solid #2a3350",
                    borderRadius: 4,
                    color: "#c9d1e0",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "#c9d1e0" }}
                  labelStyle={{ color: "#6b7593" }}
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
                        ? "bg-accent/10 ring-1 ring-accent/40"
                        : "hover:bg-panel2",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: colorMap.get(d.repo) ?? "#94a3b8",
                      }}
                    />
                    <span className="flex-1 truncate text-fg">
                      {shortenRepo(d.repo)}
                    </span>
                    <span className="tabular-nums text-muted shrink-0">
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
    <div className="shrink-0 max-h-[45%] min-h-[160px] border-t border-line bg-panel2 flex flex-col">
      <header className="px-3 py-2 flex items-center gap-2 border-b border-line bg-panel2 hud-scanlines sticky top-0 z-10">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium text-fg font-mono truncate">
          {repo}
        </span>
        <span className="text-xs text-muted">·</span>
        <span className="text-xs text-fg">{kindLabel}</span>
        <span className="text-xs text-muted">·</span>
        <span className="text-xs tabular-nums text-muted">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drill-down list"
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
        >
          <X size={12} />
          Close
        </button>
      </header>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4 text-xs text-muted">
          No items.
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-line">
          {items.map((item) => (
            <li key={`${item.repo}#${item.number}`}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-xs leading-snug hover:bg-panel"
              >
                {item.kind === "PullRequest" ? (
                  <GitPullRequest
                    size={12}
                    className="text-emerald-400 shrink-0"
                    aria-label="Pull request"
                  />
                ) : (
                  <CircleDot
                    size={12}
                    className="text-accent shrink-0"
                    aria-label="Issue"
                  />
                )}
                <span className="font-mono text-muted shrink-0">
                  {shortenRepo(item.repo)}#{item.number}
                </span>
                <span className="text-fg truncate">{item.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CornerBrackets() {
  // L-shaped cyan ticks at each corner. Pointer-events-none so they don't
  // intercept clicks on the panel content. Container must be `relative`.
  const common = "absolute w-3 h-3 border-accent pointer-events-none";
  return (
    <>
      <span className={`${common} top-0 left-0 border-t-2 border-l-2`} />
      <span className={`${common} top-0 right-0 border-t-2 border-r-2`} />
      <span className={`${common} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${common} bottom-0 right-0 border-b-2 border-r-2`} />
    </>
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
          ? "bg-accent/15 text-accent"
          : "text-muted hover:bg-panel2",
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
