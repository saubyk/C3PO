import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import type { WorkloadItem } from "../types";
import { DROID_EMPTY, EmptyState } from "./EmptyState";
import { PaneHeader } from "./PaneHeader";

export type ChartMode = "counts" | "percentages";

type Kind = "assigned" | "reviewing";
type Selection = { kind: Kind; repo: string } | null;
type RepoCount = { repo: string; count: number };

type Props = {
  login: string;
  assigned: WorkloadItem[];
  reviewing: WorkloadItem[];
  mode: ChartMode;
};

// One repo→color mapping shared by both charts (design refinement: the old
// version colored the same repo differently per chart). Keyed by short repo
// name; anything unknown gets the fallback steel-blue.
const REPO_COLORS: Record<string, string> = {
  "lightning-infra": "#55d187",
  paymentservice: "#ff7a72",
  lnd: "#56c8f5",
  nautilus: "#f5b83d",
  subasta: "#a78bfa",
  "eng-brain": "#5aa2e8",
  btcd: "#e88fc6",
  "lightning-terminal": "#6ee7d0",
  neutrino: "#c9d16b",
};

const REPO_FALLBACK = "#7d93b8";

function repoColor(repo: string): string {
  return REPO_COLORS[shortenRepo(repo)] ?? REPO_FALLBACK;
}

const DRILL_CAP = 12;

function countByRepo(items: WorkloadItem[]): RepoCount[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.repo, (m.get(it.repo) ?? 0) + 1);
  return Array.from(m, ([repo, count]) => ({ repo, count })).sort(
    (a, b) => b.count - a.count || a.repo.localeCompare(b.repo),
  );
}

export function WorkloadCharts({ login, assigned, reviewing, mode }: Props) {
  const [selection, setSelection] = useState<Selection>(null);

  // Reset slice selection whenever the developer changes — a stale selection
  // from a previous login isn't meaningful in the new dataset.
  useEffect(() => {
    setSelection(null);
  }, [login]);

  const assignedCounts = useMemo(() => countByRepo(assigned), [assigned]);
  const reviewingCounts = useMemo(() => countByRepo(reviewing), [reviewing]);

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
    <div className="flex-1 min-h-0 grid grid-cols-2">
      <WorkloadPanel
        kind="assigned"
        title="Assigned"
        data={assignedCounts}
        mode={mode}
        selection={selection}
        drillItems={drillItems}
        onSelect={handleSelect}
        onCloseDrill={() => setSelection(null)}
        emptyDetail="NO OPEN ASSIGNED ITEMS IN THE CONFIGURED ORGS."
      />
      <WorkloadPanel
        kind="reviewing"
        title="Reviewing"
        data={reviewingCounts}
        mode={mode}
        selection={selection}
        drillItems={drillItems}
        onSelect={handleSelect}
        onCloseDrill={() => setSelection(null)}
        emptyDetail="NO OPEN PRS AWAITING REVIEW."
      />
    </div>
  );
}

function WorkloadPanel({
  kind,
  title,
  data,
  mode,
  selection,
  drillItems,
  onSelect,
  onCloseDrill,
  emptyDetail,
}: {
  kind: Kind;
  title: string;
  data: RepoCount[];
  mode: ChartMode;
  selection: Selection;
  drillItems: WorkloadItem[];
  onSelect: (kind: Kind, repo: string) => void;
  onCloseDrill: () => void;
  emptyDetail: string;
}) {
  const total = sumCount(data);
  const selectedRepoHere =
    selection && selection.kind === kind ? selection.repo : null;

  return (
    <section
      className={[
        "bg-panel flex flex-col min-h-0",
        kind === "assigned" ? "border-r border-line" : "",
      ].join(" ")}
    >
      <PaneHeader title={title} count={total} countLabel="ITEMS" />
      {data.length === 0 ? (
        <EmptyState compact title={DROID_EMPTY} detail={emptyDetail} />
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <div className="flex gap-4 items-start">
            <Donut
              data={data}
              total={total}
              selectedRepo={selectedRepoHere}
              onSelect={(repo) => onSelect(kind, repo)}
              mode={mode}
            />
            <ul className="flex-1 min-w-0 space-y-0.5">
              {data.map((d) => {
                const isSelected = d.repo === selectedRepoHere;
                const color = repoColor(d.repo);
                return (
                  <li key={d.repo}>
                    <button
                      type="button"
                      onClick={() => onSelect(kind, d.repo)}
                      aria-pressed={isSelected}
                      title={d.repo}
                      className={[
                        "w-full grid grid-cols-[8px_auto_1fr_auto] items-center gap-2 px-2 py-[5px] rounded text-left",
                        isSelected
                          ? "bg-[rgba(86,200,245,.1)]"
                          : "hover:bg-[rgba(86,200,245,.07)]",
                      ].join(" ")}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-[2px]"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-mono text-[11px] text-[#dce6f5] truncate">
                        {shortenRepo(d.repo)}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-[3px] rounded bg-line min-w-4"
                      >
                        <span
                          className="block h-full rounded"
                          style={{
                            width: `${total ? (d.count / total) * 100 : 0}%`,
                            backgroundColor: color,
                            opacity: 0.7,
                          }}
                        />
                      </span>
                      <span className="font-mono text-[11px] text-muted2 tabular-nums text-right">
                        {formatValue(d.count, total, mode)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {selectedRepoHere && (
            <DrillDownCard
              repo={selectedRepoHere}
              items={drillItems}
              onClose={onCloseDrill}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Donut({
  data,
  total,
  selectedRepo,
  onSelect,
  mode,
}: {
  data: RepoCount[];
  total: number;
  selectedRepo: string | null;
  onSelect: (repo: string) => void;
  mode: ChartMode;
}) {
  const somethingSelected = selectedRepo !== null;
  return (
    <div className="relative w-[150px] h-[150px] shrink-0">
      <PieChart width={150} height={150}>
        <Pie
          data={data}
          dataKey="count"
          nameKey="repo"
          cx="50%"
          cy="50%"
          innerRadius={51}
          outerRadius={69}
          paddingAngle={2}
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
          onClick={(payload: unknown) => {
            const repo = (payload as { payload?: { repo?: string } })
              ?.payload?.repo;
            if (repo) onSelect(repo);
          }}
          style={{ cursor: "pointer" }}
        >
          {data.map((entry) => {
            const isSelected = entry.repo === selectedRepo;
            const dim = somethingSelected && !isSelected;
            return (
              <Cell
                key={entry.repo}
                fill={repoColor(entry.repo)}
                fillOpacity={dim ? 0.35 : 1}
                stroke={isSelected ? "#e8eef7" : "var(--color-panel)"}
                strokeWidth={isSelected ? 1.5 : 1}
              />
            );
          })}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-raised)",
            border: "1px solid rgba(110,150,210,.25)",
            borderRadius: 4,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--color-fg)",
          }}
          itemStyle={{ color: "var(--color-fg)" }}
          labelStyle={{ color: "var(--color-faint)" }}
          formatter={(value, _name, item) => {
            const n = typeof value === "number" ? value : Number(value);
            const repo = String(
              (item as { payload?: { repo?: string } })?.payload?.repo ?? "",
            );
            return [formatValue(n, total, mode), shortenRepo(repo)];
          }}
        />
      </PieChart>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      >
        <span className="font-display font-bold text-[24px] leading-none text-fg">
          {total}
        </span>
        <span className="font-mono text-[8.5px] tracking-[.16em] text-faint mt-1">
          OPEN
        </span>
      </div>
    </div>
  );
}

function DrillDownCard({
  repo,
  items,
  onClose,
}: {
  repo: string;
  items: WorkloadItem[];
  onClose: () => void;
}) {
  const color = repoColor(repo);
  const shown = items.slice(0, DRILL_CAP);
  const more = items.length - shown.length;
  return (
    <div className="mt-3 border border-[rgba(86,200,245,.25)] rounded-md overflow-hidden">
      <header className="bg-panel2 px-3 py-2 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-[2px] shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-[11px] text-fg truncate" title={repo}>
          {shortenRepo(repo)}
        </span>
        <span className="font-mono text-[10px] text-faint uppercase whitespace-nowrap">
          {items.length} {items.length === 1 ? "ITEM" : "ITEMS"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drill-down list"
          className="ml-auto font-mono text-[11px] text-faint hover:text-fg leading-none"
        >
          ✕
        </button>
      </header>
      <ul>
        {shown.map((item) => (
          <li key={`${item.repo}#${item.number}`}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 border-t border-line hover:bg-[rgba(86,200,245,.06)]"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-mono text-[10.5px] text-number shrink-0">
                {shortenRepo(item.repo)}#{item.number}
              </span>
              <span className="font-body font-medium text-[13px] text-fg truncate">
                {item.title}
              </span>
            </a>
          </li>
        ))}
        {more > 0 && (
          <li className="font-mono text-[10px] text-faint uppercase tracking-[.06em] px-3 py-1.5 border-t border-line">
            + {more} MORE — FULL MANIFEST ON GITHUB
          </li>
        )}
      </ul>
    </div>
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
