// Pinned color map. Locked early so refactors don't drift the palette.

const STATUS_CLASS: Record<string, string> = {
  "In progress": "bg-blue-100 text-blue-800",
  "In review": "bg-purple-100 text-purple-800",
  "Ready": "bg-amber-100 text-amber-800",
  "Todo": "bg-gray-100 text-gray-800",
  "Backlog": "bg-gray-100 text-gray-800",
  "Done": "bg-green-100 text-green-800",
};

const PRIORITY_CLASS: Record<string, string> = {
  "P0": "bg-red-100 text-red-800",
  "P1": "bg-orange-100 text-orange-800",
  "P2": "bg-yellow-100 text-yellow-800",
  "P3": "bg-yellow-100 text-yellow-800",
};

const SIZE_CLASS: Record<string, string> = {
  "XS": "bg-gray-100 text-gray-700",
  "S": "bg-gray-100 text-gray-700",
  "M": "bg-slate-100 text-slate-700",
  "L": "bg-slate-200 text-slate-800",
  "XL": "bg-slate-300 text-slate-900",
};

const FALLBACK = "bg-gray-100 text-gray-700";

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
