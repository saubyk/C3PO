import { RefreshCw } from "lucide-react";
import type { ProjectSummary } from "../types";
import { ProjectSwitcher, type ActiveProject } from "./ProjectSwitcher";

type Props = {
  projects: ProjectSummary[] | undefined;
  activeProject: ActiveProject | null;
  onActiveProjectChange: (next: ActiveProject | null) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdated: number | undefined;
  statusFilter: string;
  statusOptions: string[];
  onStatusChange: (next: string) => void;
  priorityFilter: string;
  priorityOptions: string[];
  onPriorityChange: (next: string) => void;
};

export function Header(props: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-line px-4 h-10 bg-panel hud-scanlines shrink-0">
      <ProjectSwitcher
        projects={props.projects}
        active={props.activeProject}
        onChange={props.onActiveProjectChange}
      />
      <div className="flex items-center gap-3 ml-2">
        <FilterSelect
          label="Status"
          value={props.statusFilter}
          options={props.statusOptions}
          onChange={props.onStatusChange}
        />
        <FilterSelect
          label="Priority"
          value={props.priorityFilter}
          options={props.priorityOptions}
          onChange={props.onPriorityChange}
        />
      </div>
      <span className="ml-auto flex items-center gap-3 text-xs text-muted">
        <button
          type="button"
          onClick={props.onRefresh}
          disabled={props.refreshing}
          aria-label="Refresh data from GitHub"
          className="inline-flex items-center gap-1 hover:text-fg disabled:opacity-50 disabled:cursor-wait"
        >
          <RefreshCw
            size={12}
            className={props.refreshing ? "animate-spin" : undefined}
          />
          Refresh
        </button>
        <span>
          Last updated{" "}
          {props.lastUpdated
            ? formatHHMM(props.lastUpdated)
            : <span aria-hidden="true">—</span>}
        </span>
      </span>
    </header>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted">
      {label}:
      <select
        aria-label={`${label} filter`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-line rounded px-1.5 py-0.5 bg-panel2 text-fg text-xs focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatHHMM(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
