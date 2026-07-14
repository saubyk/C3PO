import type { ReactNode } from "react";

export const DROID_EMPTY =
  "NO MATCHING RECORDS. THESE AREN'T THE DROIDS YOU'RE LOOKING FOR.";

type Props = {
  title: string;
  detail?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ title, detail, compact }: Props) {
  return (
    <div
      className={
        compact
          ? "flex items-center justify-center p-6 text-center"
          : "flex-1 flex items-center justify-center p-6 text-center"
      }
    >
      <div className="flex flex-col items-center gap-2">
        <span aria-hidden="true" className="text-gold text-[22px] leading-none">
          ⌖
        </span>
        <p className="font-mono text-[11px] tracking-[.08em] text-faint uppercase">
          {title}
        </p>
        {detail && (
          <p className="font-mono text-[10px] text-faint">{detail}</p>
        )}
      </div>
    </div>
  );
}
