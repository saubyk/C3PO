type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
};

// Inline filter input rendered inside a PaneHeader.
export function SearchBox({ value, onChange, placeholder }: Props) {
  return (
    <label className="ml-auto flex items-center gap-1.5 min-w-0 max-w-[280px] flex-1 bg-panel2 border border-[rgba(110,150,210,.2)] rounded px-2 py-1 focus-within:ring-1 focus-within:ring-accent">
      <span aria-hidden="true" className="text-faint text-[11px] shrink-0">
        ⌕
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "filter title or #number"}
        className="w-full min-w-0 font-mono text-[11px] bg-transparent text-fg placeholder:text-faint focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="font-mono text-[11px] text-faint hover:text-fg shrink-0"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </label>
  );
}
