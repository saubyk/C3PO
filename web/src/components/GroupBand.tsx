import type { User } from "../types";
import { Avatar } from "./Avatar";

type Props = {
  // User variant shows the avatar; priority variant shows a colored badge.
  avatar?: User;
  label: string;
  labelColor?: string;
  count: number;
  badge?: string;
  badgeColor?: string;
};

// Sticky separator band between groups — the redesign's key fix for rows
// blurring together. Used for per-person groups and, when an assignee is
// selected, per-priority bands.
export function GroupBand({
  avatar,
  label,
  labelColor,
  count,
  badge,
  badgeColor,
}: Props) {
  const accent = labelColor ?? "#f0d78c";
  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-2.5 px-3 py-1.5 border-b border-line"
      style={{
        background: "linear-gradient(180deg, #101c30, #0c1526)",
        borderTop: `1px solid ${badgeColor ? hexToRgba(badgeColor, 0.3) : "rgba(240,192,90,.3)"}`,
      }}
    >
      {avatar ? (
        <Avatar user={avatar} size={20} />
      ) : (
        <span
          aria-hidden="true"
          className="w-5 h-5 rounded flex items-center justify-center font-mono font-semibold text-[10px] shrink-0 border"
          style={{
            color: badgeColor ?? accent,
            borderColor: hexToRgba(badgeColor ?? accent, 0.5),
            backgroundColor: hexToRgba(badgeColor ?? accent, 0.12),
          }}
        >
          {badge ?? "·"}
        </span>
      )}
      <span
        className="font-display font-semibold text-[12.5px] tracking-[.08em] uppercase whitespace-nowrap"
        style={{ color: accent }}
      >
        {label}
      </span>
      <span className="font-mono text-[10px] text-accent/75 uppercase whitespace-nowrap">
        {count} {count === 1 ? "ITEM" : "ITEMS"}
      </span>
      <span
        aria-hidden="true"
        className="flex-1 h-px"
        style={{
          background: `linear-gradient(90deg, ${hexToRgba(badgeColor ?? "#f0c05a", 0.25)}, transparent)`,
        }}
      />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
