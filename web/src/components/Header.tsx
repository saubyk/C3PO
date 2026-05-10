import { RefreshCw } from "lucide-react";
import { ACTIVE_PROJECT, useHealth, useProjects } from "../api";

type Props = {
  statusFilter: string;
  statusOptions: string[];
  onStatusChange: (next: string) => void;
  priorityFilter: string;
  priorityOptions: string[];
  onPriorityChange: (next: string) => void;
};

export function Header({
  statusFilter,
  statusOptions,
  onStatusChange,
  priorityFilter,
  priorityOptions,
  onPriorityChange,
}: Props) {
  const { data } = useHealth();
  const projects = useProjects();
  const login = data?.status === "ok" ? data.login : null;
  const active = projects.data?.find(
    (p) => p.owner === ACTIVE_PROJECT.owner && p.number === ACTIVE_PROJECT.number,
  );
  const projectLabel = active?.title ?? `#${ACTIVE_PROJECT.number}`;

  return (
    <header className="flex items-center gap-3 border-b border-gray-200 px-4 h-10 bg-white shrink-0">
      <h1 className="font-semibold text-gray-900">C3PO</h1>
      <span className="text-gray-300">·</span>
      <span className="text-sm text-gray-700">
        <span className="text-gray-500">{ACTIVE_PROJECT.owner}</span>
        <span className="text-gray-400 mx-1">/</span>
        <span className="font-medium">{projectLabel}</span>
      </span>
      <div className="flex items-center gap-3 ml-4">
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={onStatusChange}
        />
        <FilterSelect
          label="Priority"
          value={priorityFilter}
          options={priorityOptions}
          onChange={onPriorityChange}
        />
      </div>
      <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
        <button
          disabled
          aria-label="Refresh (coming in M6)"
          className="inline-flex items-center gap-1 cursor-not-allowed opacity-50"
        >
          <RefreshCw size={12} /> Refresh
        </button>
        <span>Last updated —</span>
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
