import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import { ApiError, useItems, useProjects } from "../api";
import { Header } from "../components/Header";
import { AssigneeList } from "../components/AssigneeList";
import { AssignedColumn } from "../components/AssignedColumn";
import { ReviewColumn } from "../components/ReviewColumn";
import { EmptyState } from "../components/EmptyState";
import { SkeletonRows } from "../components/Skeletons";
import {
  NetworkErrorBanner,
  RateLimitBanner,
} from "../components/ErrorBanner";
import type { ActiveProject } from "../components/ProjectSwitcher";
import {
  ALL,
  HIDE_DONE,
  deriveTeam,
  passesPriority,
  passesStatus,
  priorityOptions,
  statusOptions,
} from "../components/grouping";

const ACTIVE_PROJECT_KEY = "c3po-active-project";

export default function SprintBoardRoute() {
  const queryClient = useQueryClient();

  const [activeProject, setActiveProjectState] =
    useState<ActiveProject | null>(loadActiveProject);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissedAt, setBannerDismissedAt] = useState(0);

  const projects = useProjects();

  // If the saved selection is no longer in the projects list, clear it.
  // Token scope changed, project deleted, etc.
  useEffect(() => {
    if (!projects.data || !activeProject) return;
    const exists = projects.data.some(
      (p) =>
        p.owner === activeProject.owner && p.number === activeProject.number,
    );
    if (!exists) setActiveProjectState(null);
  }, [projects.data, activeProject]);

  const setActiveProject = useCallback((next: ActiveProject | null) => {
    setActiveProjectState(next);
    try {
      if (next) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch {
      // localStorage may be unavailable (private mode); not worth surfacing.
    }
  }, []);

  // Only enable item-fetching once we know the saved project is valid.
  const verifiedActive = useMemo<ActiveProject | null>(() => {
    if (!activeProject) return null;
    if (!projects.data) return null;
    return projects.data.some(
      (p) =>
        p.owner === activeProject.owner && p.number === activeProject.number,
    )
      ? activeProject
      : null;
  }, [activeProject, projects.data]);

  const items = useItems(
    verifiedActive?.owner ?? null,
    verifiedActive?.number ?? null,
  );

  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(HIDE_DONE);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [assignedSearch, setAssignedSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");

  // Reset selection + searches when the active project changes.
  useEffect(() => {
    setSelectedLogin(null);
    setAssignedSearch("");
    setReviewSearch("");
  }, [verifiedActive?.owner, verifiedActive?.number]);

  const allItems = items.data ?? [];
  const filtered = useMemo(
    () =>
      allItems.filter(
        (i) =>
          passesStatus(i, statusFilter) && passesPriority(i, priorityFilter),
      ),
    [allItems, statusFilter, priorityFilter],
  );
  const team = useMemo(() => deriveTeam(filtered), [filtered]);
  const statusChoices = useMemo(() => statusOptions(allItems), [allItems]);
  const priorityChoices = useMemo(
    () => priorityOptions(allItems),
    [allItems],
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const calls: Array<Promise<unknown>> = [
        fetch("/api/projects?refresh=1"),
      ];
      if (verifiedActive) {
        calls.push(
          fetch(
            `/api/projects/${verifiedActive.owner}/${verifiedActive.number}/items?refresh=1`,
          ),
        );
      }
      await Promise.allSettled(calls);
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, queryClient, verifiedActive]);

  const lastUpdated = items.dataUpdatedAt || projects.dataUpdatedAt;

  // Latest error worth surfacing to the user. items errors trump projects
  // errors (the user is staring at the columns).
  const liveError =
    (items.error as unknown) ?? (projects.error as unknown) ?? null;
  const showErrorBanner =
    !!liveError && (lastUpdated ?? 0) < bannerDismissedAt
      ? false
      : !!liveError;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header
        projects={projects.data}
        activeProject={activeProject}
        onActiveProjectChange={setActiveProject}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastUpdated={lastUpdated || undefined}
        statusFilter={statusFilter}
        statusOptions={statusChoices}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        priorityOptions={priorityChoices}
        onPriorityChange={setPriorityFilter}
      />
      {showErrorBanner && liveError instanceof ApiError &&
        liveError.status === 429 && liveError.resetAt && (
          <RateLimitBanner
            resetAt={liveError.resetAt}
            onDismiss={() => setBannerDismissedAt(Date.now())}
          />
        )}
      {showErrorBanner && (!(liveError instanceof ApiError) ||
        liveError.status !== 429) && (
        <NetworkErrorBanner
          message={
            liveError instanceof Error ? liveError.message : "Request failed."
          }
          onRetry={handleRefresh}
          onDismiss={() => setBannerDismissedAt(Date.now())}
        />
      )}
      {!verifiedActive ? (
        <EmptyState
          title={
            projects.isPending ? "Loading projects…" : "Pick a project to begin."
          }
          detail={
            projects.data && projects.data.length > 0
              ? `${projects.data.length} project${projects.data.length === 1 ? "" : "s"} visible.`
              : projects.data
                ? "No Projects v2 boards visible to your token."
                : null
          }
        />
      ) : (
        <Group
          orientation="horizontal"
          id="c3po-columns"
          defaultLayout={initialLayout}
          onLayoutChanged={persistLayout}
          className="flex-1 min-h-0"
        >
          <Panel
            id="left"
            defaultSize="18%"
            minSize="12%"
            maxSize="30%"
            className="overflow-y-auto flex flex-col"
          >
            <ColumnHeader title="Assignees" />
            {items.isPending ? (
              <SkeletonRows count={8} />
            ) : (
              <AssigneeList
                team={team}
                selectedLogin={selectedLogin}
                onSelect={setSelectedLogin}
              />
            )}
          </Panel>
          <ResizeHandle />
          <Panel
            id="middle"
            defaultSize="41%"
            minSize="20%"
            className="overflow-y-auto flex flex-col"
          >
            <ColumnHeader title="Assigned" />
            {items.isPending ? (
              <SkeletonRows count={6} variant="wide" />
            ) : (
              <AssignedColumn
                items={filtered}
                selectedLogin={selectedLogin}
                search={assignedSearch}
                onSearchChange={setAssignedSearch}
              />
            )}
          </Panel>
          <ResizeHandle />
          <Panel
            id="right"
            defaultSize="41%"
            minSize="20%"
            className="overflow-y-auto flex flex-col"
          >
            <ColumnHeader title="Reviewing" />
            {items.isPending ? (
              <SkeletonRows count={6} variant="wide" />
            ) : (
              <ReviewColumn
                items={filtered}
                selectedLogin={selectedLogin}
                search={reviewSearch}
                onSearchChange={setReviewSearch}
              />
            )}
          </Panel>
        </Group>
      )}
    </div>
  );
}

const LAYOUT_STORAGE_KEY = "c3po-columns-v2";

const initialLayout = readLayout();

function readLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Layout;
  } catch {
    // ignore — defaults will apply
  }
  return undefined;
}

function persistLayout(layout: Layout) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

function loadActiveProject(): ActiveProject | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as ActiveProject).owner === "string" &&
      typeof (parsed as ActiveProject).number === "number"
    ) {
      return parsed as ActiveProject;
    }
  } catch {
    // ignore
  }
  return null;
}

function ResizeHandle() {
  return (
    <Separator
      aria-label="Resize column"
      style={{ width: 4 }}
      className="bg-gray-200 hover:bg-blue-300 active:bg-blue-500 transition-colors"
    />
  );
}

function ColumnHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-2 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 sticky top-0 bg-white z-10">
      {title}
    </div>
  );
}
