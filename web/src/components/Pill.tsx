// Pinned color map. Locked early so refactors don't drift the palette.
// Dark-mode: tinted background at low opacity + bright text.

const STATUS_CLASS: Record<string, string> = {
  "In progress": "bg-blue-500/15 text-blue-300",
  "In review": "bg-purple-500/15 text-purple-300",
  "Ready": "bg-amber-500/15 text-amber-300",
  "Todo": "bg-slate-500/15 text-slate-300",
  "Backlog": "bg-slate-500/15 text-slate-300",
  "Done": "bg-emerald-500/15 text-emerald-300",
};

const PRIORITY_CLASS: Record<string, string> = {
  "P0": "bg-red-500/20 text-red-300",
  "P1": "bg-orange-500/15 text-orange-300",
  "P2": "bg-yellow-500/15 text-yellow-300",
  "P3": "bg-yellow-500/15 text-yellow-300",
};

const SIZE_CLASS: Record<string, string> = {
  "XS": "bg-slate-500/10 text-slate-400",
  "S": "bg-slate-500/10 text-slate-400",
  "M": "bg-slate-500/15 text-slate-300",
  "L": "bg-slate-500/20 text-slate-200",
  "XL": "bg-slate-500/25 text-slate-100",
};

const FALLBACK = "bg-slate-500/15 text-slate-300";

export type PillKind = "status" | "priority" | "size";

function colorFor(kind: PillKind, value: string): string {
  switch (kind) {
    case "status":
      return STATUS_CLASS[value] ?? FALLBACK;
    case "priority":
      return PRIORITY_CLASS[value] ?? FALLBACK;
    case "size":
      return SIZE_CLASS[value] ?? FALLBACK;
  }
}

export function Pill({ kind, value }: { kind: PillKind; value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colorFor(kind, value)}`}
    >
      {value}
    </span>
  );
}
