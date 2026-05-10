import { RefreshCw } from "lucide-react";
import { useHealth } from "../api";
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
  const { data } = useHealth();
  const login = data?.status === "ok" ? data.login : null;

  return (
    <header className="flex items-center gap-3 border-b border-gray-200 px-4 h-10 bg-white shrink-0">
      <h1 className="font-semibold text-gray-900">C3PO</h1>
      <span className="text-gray-300">·</span>
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
      <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
        <button
          type="button"
          onClick={props.onRefresh}
          disabled={props.refreshing}
          aria-label="Refresh data from GitHub"
          className="inline-flex items-center gap-1 hover:text-gray-700 disabled:opacity-50 disabled:cursor-wait"
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
        {login && <span className="font-mono">@{login}</span>}
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
    <label className="flex items-center gap-1 text-xs text-gray-500">
      {label}:
      <select
        aria-label={`${label} filter`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
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
