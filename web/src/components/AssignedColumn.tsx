import type { ProjectItem } from "../types";
import { Avatar } from "./Avatar";
import { ItemRow } from "./ItemRow";
import { groupByUser, isDone } from "./grouping";

export function AssignedColumn({ items }: { items: ProjectItem[] }) {
  // Aggregate mode: hide Done by default (FR-5), then group by assignee.
  const visible = items.filter((x) => !isDone(x));
  const groups = groupByUser(visible, (item) => item.assignees);

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
