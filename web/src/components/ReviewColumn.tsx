import type { ProjectItem } from "../types";
import { Avatar } from "./Avatar";
import { ItemRow } from "./ItemRow";
import { groupByUser, isDone } from "./grouping";

export function ReviewColumn({ items }: { items: ProjectItem[] }) {
  // Aggregate mode: only PRs, hide Done, group by requested reviewer.
  const visible = items.filter(
    (x) => x.contentType === "PullRequest" && !isDone(x),
  );
  const groups = groupByUser(visible, (item) => item.requestedReviewers);

  if (groups.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-gray-500">
        Nothing in the review queue.
      </p>
    );
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
