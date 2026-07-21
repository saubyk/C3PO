import type { ProjectItem } from "../types";
import { withAlpha } from "./color";

// Priority chip — the row's primary signal. Fixed-width mono badge.
// Colors are theme variables so light mode can swap them (index.css).
const PRIORITY_STYLE: Record<
  string,
  { color: string; border: string; bg: string }
> = {
  P0: {
    color: "var(--color-red)",
    border: withAlpha("var(--color-red)", 55),
    bg: withAlpha("var(--color-red)", 12),
  },
  P1: {
    color: "var(--color-amber)",
    border: withAlpha("var(--color-amber)", 50),
    bg: withAlpha("var(--color-amber)", 10),
  },
  P2: {
    color: "var(--color-prio2)",
    border: withAlpha("var(--color-prio2)", 35),
    bg: "transparent",
  },
  P3: {
    color: "var(--color-prio3)",
    border: withAlpha("var(--color-prio3)", 30),
    bg: "transparent",
  },
};

export function PriorityChip({ value }: { value: string | null }) {
  const style = value ? PRIORITY_STYLE[value] : undefined;
  if (!style) {
    return (
      <span
        aria-hidden={!value}
        title={value ?? "No priority"}
        className="font-mono font-semibold text-[10px] text-center rounded-[3px] py-px"
        style={{ color: "var(--color-prio-none)" }}
      >
        {value ?? "—"}
      </span>
    );
  }
  return (
    <span
      className="font-mono font-semibold text-[10px] text-center rounded-[3px] py-px border"
      style={{
        color: style.color,
        borderColor: style.border,
        backgroundColor: style.bg,
      }}
    >
      {value}
    </span>
  );
}

// Type tag — PR / ISS by contentType.
const TYPE_STYLE: Record<
  ProjectItem["contentType"],
  { label: string; color: string; border: string }
> = {
  PullRequest: {
    label: "PR",
    color: "var(--color-type-pr)",
    border: withAlpha("var(--color-type-pr)", 40),
  },
  Issue: {
    label: "ISS",
    color: "var(--color-type-iss)",
    border: withAlpha("var(--color-type-iss)", 40),
  },
};

export function TypeTag({
  contentType,
}: {
  contentType: ProjectItem["contentType"];
}) {
  const style = TYPE_STYLE[contentType];
  return (
    <span
      className="font-mono text-[8.5px] tracking-[.05em] text-center rounded-[3px] py-0.5 border"
      style={{ color: style.color, borderColor: style.border }}
    >
      {style.label}
    </span>
  );
}

// Status — 7px glowing dot + mono label.
export const STATUS_DOT_COLOR: Record<string, string> = {
  "In progress": "var(--color-green)",
  "In review": "var(--color-violet)",
  Ready: "var(--color-amber)",
  Todo: "var(--color-prio2)",
  Backlog: "var(--color-status-backlog)",
  Done: "var(--color-status-done)",
};

const STATUS_FALLBACK = "var(--color-status-backlog)";

export function StatusDot({ status }: { status: string | null }) {
  const color = (status && STATUS_DOT_COLOR[status]) || STATUS_FALLBACK;
  return (
    <span className="flex items-center justify-end gap-1.5 min-w-0">
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span
        className="font-mono text-[9.5px] tracking-[.06em] uppercase truncate"
        style={{ color }}
      >
        {status ?? "—"}
      </span>
    </span>
  );
}
