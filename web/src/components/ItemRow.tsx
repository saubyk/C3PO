import type { ProjectItem } from "../types";
import { AgeBadge } from "./AgeBadge";
import { PriorityChip, StatusDot, TypeTag } from "./chips";
import { singleSelect } from "./grouping";

// One board row: priority chip | type tag | #number | title | age | status.
// Size is deliberately not shown — it was noise (see design handoff).
export function ItemRow({ item }: { item: ProjectItem }) {
  const status = singleSelect(item, "Status");
  const priority = singleSelect(item, "Priority");
  const statusUpdatedAt = item.fields.Status?.updatedAt ?? null;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
      className="grid grid-cols-[32px_34px_58px_minmax(0,1fr)_44px_108px] gap-2 items-center px-3 py-2 border-b border-[rgba(110,150,210,.07)] hover:bg-[rgba(86,200,245,.06)] cursor-pointer"
    >
      <PriorityChip value={priority} />
      <TypeTag contentType={item.contentType} />
      <span className="font-mono text-[11px] text-number truncate">
        #{item.number}
      </span>
      <span className="font-body font-medium text-[13.5px] text-fg truncate">
        {item.title}
      </span>
      <span className="text-right">
        <AgeBadge updatedAt={statusUpdatedAt} />
      </span>
      <StatusDot status={status} />
    </a>
  );
}
