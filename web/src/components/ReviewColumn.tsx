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

export function ReviewColumn({
  items,
  selectedLogin,
  search,
  onSearchChange,
}: Props) {
  // PRs only — review queue is meaningless for issues.
  const prs = items.filter((i) => i.contentType === "PullRequest");
  const searched = prs.filter((i) => passesSearch(i, search));

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
    .filter((i) =>
      i.reviewers.some((u) => u.login === selectedLogin),
    )
    .sort(sortItems);
  if (visible.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted">
        Nothing waiting on <span className="font-mono">@{selectedLogin}</span>.
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
  const groups = groupByUser(items, (item) => item.reviewers);
  if (groups.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted">
        Nothing in the review queue.
      </p>
    );
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.user.login}>
          <header className="flex items-center gap-2 px-3 py-1 bg-panel border-b border-line text-xs text-fg">
            <Avatar user={g.user} size={16} />
            <span className="font-medium">{g.user.login}</span>
            <span className="text-muted tabular-nums">{g.items.length}</span>
          </header>
          {g.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}
