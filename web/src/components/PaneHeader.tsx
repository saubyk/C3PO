import type { ReactNode } from "react";

type Props = {
  title: string;
  count?: number;
  countLabel?: string;
  children?: ReactNode;
};

// The bracket-header pattern shared by every pane (assignees rail, board
// columns, workload panels): gold targeting brackets, display-font title,
// mono count, optional right-aligned extras (e.g. a filter input).
export function PaneHeader({ title, count, countLabel, children }: Props) {
  return (
    <div className="bracket-header px-3.5 py-2.5 border-b border-line bg-panel flex items-center gap-2 shrink-0">
      <h2 className="font-display font-semibold text-[12px] tracking-[.16em] uppercase text-accent whitespace-nowrap">
        {title}
      </h2>
      {count !== undefined && (
        <span className="font-mono text-[10px] text-faint uppercase whitespace-nowrap">
          · {count} {countLabel ?? "ITEMS"}
        </span>
      )}
      {children}
    </div>
  );
}
