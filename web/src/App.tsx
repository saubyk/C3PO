import { ACTIVE_PROJECT, useItems, useTeam } from "./api";
import { Header } from "./components/Header";
import { AssigneeList } from "./components/AssigneeList";
import { AssignedColumn } from "./components/AssignedColumn";
import { ReviewColumn } from "./components/ReviewColumn";

export default function App() {
  const items = useItems(ACTIVE_PROJECT.owner, ACTIVE_PROJECT.number);
  const team = useTeam(ACTIVE_PROJECT.owner, ACTIVE_PROJECT.number);

  return (
    <main className="h-screen flex flex-col bg-white text-gray-900">
      <Header />
      <div className="flex flex-1 min-h-0 divide-x divide-gray-200">
        <aside className="w-56 shrink-0 overflow-y-auto">
          <ColumnHeader title="Assignees" />
          <AsyncSlot query={team}>
            {(data) => <AssigneeList team={data} />}
          </AsyncSlot>
        </aside>
        <section className="flex-1 min-w-0 overflow-y-auto">
          <ColumnHeader title="Assigned" />
          <AsyncSlot query={items}>
            {(data) => <AssignedColumn items={data} />}
          </AsyncSlot>
        </section>
        <section className="flex-1 min-w-0 overflow-y-auto">
          <ColumnHeader title="Reviewing" />
          <AsyncSlot query={items}>
            {(data) => <ReviewColumn items={data} />}
          </AsyncSlot>
        </section>
      </div>
    </main>
  );
}

function ColumnHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-2 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 sticky top-0 bg-white z-10">
      {title}
    </div>
  );
}

type Queryish<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
};

function AsyncSlot<T>({
  query,
  children,
}: {
  query: Queryish<T>;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) {
    return <p className="px-3 py-2 text-xs text-gray-500">Loading…</p>;
  }
  if (query.error) {
    const msg =
      query.error instanceof Error ? query.error.message : "Request failed.";
    return <p className="px-3 py-2 text-xs text-red-600">{msg}</p>;
  }
  if (query.data) return <>{children(query.data)}</>;
  return null;
}
