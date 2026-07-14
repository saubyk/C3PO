import type { ProjectItem } from "../types";

// Priority chip — the row's primary signal. Fixed-width mono badge.
const PRIORITY_STYLE: Record<
  string,
  { color: string; border: string; bg: string }
> = {
  P0: {
    color: "#ff6b6b",
    border: "rgba(255,107,107,.55)",
    bg: "rgba(255,107,107,.12)",
  },
  P1: {
    color: "#f5b83d",
    border: "rgba(245,184,61,.5)",
    bg: "rgba(245,184,61,.1)",
  },
  P2: {
    color: "#7d93b8",
    border: "rgba(125,147,184,.35)",
    bg: "transparent",
  },
  P3: {
    color: "#5c718f",
    border: "rgba(92,113,143,.3)",
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
        style={{ color: "#3d4f6d" }}
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
  PullRequest: { label: "PR", color: "#6ee7a0", border: "rgba(110,231,160,.4)" },
  Issue: { label: "ISS", color: "#5aa2e8", border: "rgba(90,162,232,.4)" },
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
  "In progress": "#55d187",
  "In review": "#a78bfa",
  Ready: "#f5b83d",
  Todo: "#7d93b8",
  Backlog: "#64789a",
  Done: "#3a8f61",
};

const STATUS_FALLBACK = "#64789a";

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
