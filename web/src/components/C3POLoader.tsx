import { C3POIcon } from "./C3POIcon";

type Props = {
  label?: string;
  size?: number;
};

export function C3POLoader({ label = "Loading", size = 80 }: Props) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-3 p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <C3POIcon size={size} blinking />
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-faint">
        {label}
      </span>
    </div>
  );
}
