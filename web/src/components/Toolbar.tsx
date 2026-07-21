import type { ReactNode } from "react";

// Shared pieces of the 42px sub-toolbars under the top bar (one per tab).

export function SubToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="h-[42px] px-4 bg-panel border-b border-line flex items-center gap-4 shrink-0">
      {children}
    </div>
  );
}

export function ToolbarLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] tracking-[.12em] text-faint uppercase whitespace-nowrap">
      {children}
    </span>
  );
}

export const SELECT_CLASS =
  "bg-raised border border-line2 rounded font-mono text-[11px] text-fg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50";

export function SyncCluster({
  lastUpdated,
  onRefresh,
  refreshing,
  refreshDisabled,
  refreshLabel,
}: {
  lastUpdated: number | undefined;
  onRefresh: () => void;
  refreshing: boolean;
  refreshDisabled?: boolean;
  refreshLabel: string;
}) {
  return (
    <span className="ml-auto flex items-center gap-3">
      <span className="font-mono text-[10px] tracking-[.08em] text-faint uppercase whitespace-nowrap">
        LAST SYNC{" "}
        {lastUpdated
          ? formatHHMMSS(lastUpdated)
          : <span aria-hidden="true">—</span>}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing || refreshDisabled}
        aria-label={refreshLabel}
        className="inline-flex items-center gap-1.5 border border-accent/35 text-accent font-mono text-[11px] rounded px-2 py-1 hover:bg-accent/8 disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
      >
        <span
          aria-hidden="true"
          className={refreshing ? "inline-block animate-spin" : "inline-block"}
        >
          ⟳
        </span>
        RECALIBRATE
      </button>
    </span>
  );
}

export function formatHHMMSS(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
