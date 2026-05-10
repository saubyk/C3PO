import { CircleDot, CircleSlash, GitPullRequest, GitMerge } from "lucide-react";
import type { ProjectItem } from "../types";
import { Pill } from "./Pill";

function singleSelect(item: ProjectItem, name: string): string | null {
  const v = item.fields[name];
  return v?.kind === "single_select" ? v.optionName : null;
}

export function ItemRow({ item }: { item: ProjectItem }) {
  const status = singleSelect(item, "Status");
  const priority = singleSelect(item, "Priority");
  const size = singleSelect(item, "Size");

  const isPR = item.contentType === "PullRequest";
  const isMerged = isPR && item.state === "MERGED";
  const isClosedNotMerged = item.state === "CLOSED";

  const Icon = isMerged
    ? GitMerge
    : isPR
      ? GitPullRequest
      : isClosedNotMerged
        ? CircleSlash
        : CircleDot;

  const iconColor = isMerged
    ? "text-purple-600"
    : isClosedNotMerged
      ? "text-red-600"
      : "text-green-600";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 border-b border-gray-100 text-sm leading-tight"
    >
      <Icon className={`${iconColor} shrink-0`} size={14} />
      <span className="font-mono text-xs text-gray-500 shrink-0">#{item.number}</span>
      <span className="truncate text-gray-900 flex-1">{item.title}</span>
      <span className="flex items-center gap-1 shrink-0">
        {status && <Pill kind="status" value={status} />}
        {priority && <Pill kind="priority" value={priority} />}
        {size && <Pill kind="size" value={size} />}
      </span>
    </a>
  );
}
