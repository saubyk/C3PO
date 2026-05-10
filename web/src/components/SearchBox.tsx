import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
};

export function SearchBox({ value, onChange, placeholder }: Props) {
  return (
    <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
      <label className="flex items-center gap-1.5">
        <Search size={12} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Filter by title or #number"}
          className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </label>
    </div>
  );
}
