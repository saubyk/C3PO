import type { ProjectItem } from "../types";
import { DROID_EMPTY, EmptyState } from "./EmptyState";
import { GroupBand } from "./GroupBand";
import { ItemRow } from "./ItemRow";
import { PaneHeader } from "./PaneHeader";
import { SearchBox } from "./SearchBox";
import { groupByPriority, groupByUser, passesSearch } from "./grouping";

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
  const visible = selectedLogin
    ? searched.filter((i) =>
        i.assignees.some((u) => u.login === selectedLogin),
      )
    : searched;

  return (
    <>
      <PaneHeader title="Assigned" count={visible.length} countLabel="ITEMS">
        <SearchBox value={search} onChange={onSearchChange} />
      </PaneHeader>
      {/* key remounts the scroll container when the assignee filter changes,
          resetting scroll to the top. */}
      <div
        key={selectedLogin ?? "__all__"}
        className="flex-1 overflow-y-auto min-h-0 pb-6"
      >
        {selectedLogin ? (
          <PriorityView items={visible} />
        ) : (
          <GroupedView items={visible} />
        )}
      </div>
    </>
  );
}

function PriorityView({ items }: { items: ProjectItem[] }) {
  const groups = groupByPriority(items);
  if (groups.length === 0) {
    return <EmptyState compact title={DROID_EMPTY} />;
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.band.key} className="mb-4">
          <GroupBand
            label={g.band.label}
            labelColor={g.band.color}
            badge={g.band.badge}
            badgeColor={g.band.color}
            count={g.items.length}
          />
          {g.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}

function GroupedView({ items }: { items: ProjectItem[] }) {
  const groups = groupByUser(items, (item) => item.assignees);
  if (groups.length === 0) {
    return <EmptyState compact title={DROID_EMPTY} />;
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.user.login} className="mb-4">
          <GroupBand
            avatar={g.user}
            label={g.user.login}
            count={g.items.length}
          />
          {g.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}
