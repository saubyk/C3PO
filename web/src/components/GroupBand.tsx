import type { User } from "../types";
import { Avatar } from "./Avatar";
import { withAlpha } from "./color";

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
  const accent = labelColor ?? "var(--color-gold-name)";
  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-2.5 px-3 py-1.5 border-b border-line"
      style={{
        background:
          "linear-gradient(180deg, var(--color-raised), var(--color-panel))",
        borderTop: `1px solid ${withAlpha(badgeColor ?? "var(--color-gold)", 30)}`,
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
            borderColor: withAlpha(badgeColor ?? accent, 50),
            backgroundColor: withAlpha(badgeColor ?? accent, 12),
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
          background: `linear-gradient(90deg, ${withAlpha(badgeColor ?? "var(--color-gold)", 25)}, transparent)`,
        }}
      />
    </div>
  );
}
