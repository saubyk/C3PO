import type { ProjectSummary } from "../types";
import { ProjectSwitcher, type ActiveProject } from "./ProjectSwitcher";
import { SELECT_CLASS, SubToolbar, SyncCluster, ToolbarLabel } from "./Toolbar";

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

// Sprint Board sub-toolbar: SPRINT / STATUS / PRIORITY selects + sync cluster.
export function Header(props: Props) {
  return (
    <SubToolbar>
      <label className="flex items-center gap-2 min-w-0">
        <ToolbarLabel>Sprint</ToolbarLabel>
        <ProjectSwitcher
          projects={props.projects}
          active={props.activeProject}
          onChange={props.onActiveProjectChange}
        />
      </label>
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
      <SyncCluster
        lastUpdated={props.lastUpdated}
        onRefresh={props.onRefresh}
        refreshing={props.refreshing}
        refreshLabel="Refresh data from GitHub"
      />
    </SubToolbar>
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
    <label className="flex items-center gap-2">
      <ToolbarLabel>{label}</ToolbarLabel>
      <select
        aria-label={`${label} filter`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
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
