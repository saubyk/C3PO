import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import { ACTIVE_PROJECT, useItems } from "./api";
import { Header } from "./components/Header";
import { AssigneeList } from "./components/AssigneeList";
import { AssignedColumn } from "./components/AssignedColumn";
import { ReviewColumn } from "./components/ReviewColumn";
import {
  ALL,
  HIDE_DONE,
  deriveTeam,
  passesPriority,
  passesStatus,
  priorityOptions,
  statusOptions,
} from "./components/grouping";

export default function App() {
  const items = useItems(ACTIVE_PROJECT.owner, ACTIVE_PROJECT.number);

  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(HIDE_DONE);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [assignedSearch, setAssignedSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");

  const allItems = items.data ?? [];

  // Apply global filters once. Per-column search is applied inside each column.
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
  const priorityChoices = useMemo(() => priorityOptions(allItems), [allItems]);

  return (
    <main className="h-screen flex flex-col bg-white text-gray-900">
      <Header
        statusFilter={statusFilter}
        statusOptions={statusChoices}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        priorityOptions={priorityChoices}
        onPriorityChange={setPriorityFilter}
      />
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
          <AsyncSlot loading={items.isLoading} error={items.error}>
            <AssigneeList
              team={team}
              selectedLogin={selectedLogin}
              onSelect={setSelectedLogin}
            />
          </AsyncSlot>
        </Panel>
        <ResizeHandle />
        <Panel
          id="middle"
          defaultSize="41%"
          minSize="20%"
          className="overflow-y-auto flex flex-col"
        >
          <ColumnHeader title="Assigned" />
          <AsyncSlot loading={items.isLoading} error={items.error}>
            <AssignedColumn
              items={filtered}
              selectedLogin={selectedLogin}
              search={assignedSearch}
              onSearchChange={setAssignedSearch}
            />
          </AsyncSlot>
        </Panel>
        <ResizeHandle />
        <Panel
          id="right"
          defaultSize="41%"
          minSize="20%"
          className="overflow-y-auto flex flex-col"
        >
          <ColumnHeader title="Reviewing" />
          <AsyncSlot loading={items.isLoading} error={items.error}>
            <ReviewColumn
              items={filtered}
              selectedLogin={selectedLogin}
              search={reviewSearch}
              onSearchChange={setReviewSearch}
            />
          </AsyncSlot>
        </Panel>
      </Group>
    </main>
  );
}

// Bumped from "c3po-columns" to invalidate layouts saved before sizes were
// pixels-vs-percent fixed.
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
    // ignore — quota or private mode; not worth surfacing
  }
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

function AsyncSlot({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  if (loading) {
    return <p className="px-3 py-2 text-xs text-gray-500">Loading…</p>;
  }
  if (error) {
    const msg = error instanceof Error ? error.message : "Request failed.";
    return <p className="px-3 py-2 text-xs text-red-600">{msg}</p>;
  }
  return <>{children}</>;
}
