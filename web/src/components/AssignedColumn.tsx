import type { ProjectItem } from "../types";
import { Avatar } from "./Avatar";
import { ItemRow } from "./ItemRow";
import { SearchBox } from "./SearchBox";
import { groupByUser, passesSearch, sortItems } from "./grouping";

type Props = {
  items: ProjectItem[];
  selectedLogin: string | null;
  search: string;
  onSearchChange: (next: string) => void;
};

export function AssignedColumn({
  items,
  selectedLogin,
  search,
  onSearchChange,
}: Props) {
  const searched = items.filter((i) => passesSearch(i, search));

  return (
    <>
      <SearchBox value={search} onChange={onSearchChange} />
      {selectedLogin
        ? <FlatView items={searched} selectedLogin={selectedLogin} />
        : <GroupedView items={searched} />}
    </>
  );
}

function FlatView({
  items,
  selectedLogin,
}: {
  items: ProjectItem[];
  selectedLogin: string;
}) {
  const visible = items
    .filter((i) => i.assignees.some((u) => u.login === selectedLogin))
    .sort(sortItems);
  if (visible.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-gray-500">
        Nothing assigned to <span className="font-mono">@{selectedLogin}</span>.
      </p>
    );
  }
  return (
    <div>
      {visible.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function GroupedView({ items }: { items: ProjectItem[] }) {
  const groups = groupByUser(items, (item) => item.assignees);
  if (groups.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-500">No assigned items.</p>;
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.user.login}>
          <header className="flex items-center gap-2 px-3 py-1 bg-gray-50 border-b border-gray-200 text-xs text-gray-700">
            <Avatar user={g.user} size={16} />
            <span className="font-medium">{g.user.login}</span>
            <span className="text-gray-500 tabular-nums">{g.items.length}</span>
          </header>
          {g.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}
