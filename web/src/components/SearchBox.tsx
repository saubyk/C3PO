import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
};

export function SearchBox({ value, onChange, placeholder }: Props) {
  return (
    <div className="px-3 py-1.5 border-b border-line bg-panel hud-scanlines shrink-0">
      <label className="flex items-center gap-1.5">
        <Search size={12} className="text-muted shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Filter by title or #number"}
          className="w-full text-xs bg-panel2 border border-line text-fg placeholder:text-muted rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-muted hover:text-fg shrink-0"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </label>
    </div>
  );
}
