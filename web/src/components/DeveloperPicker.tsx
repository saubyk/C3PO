import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { RosterUser } from "../types";

type Props = {
  roster: RosterUser[];
  selectedLogin: string | null;
  onSelect: (login: string | null) => void;
};

// Visually consistent with AssigneeList (v0.1) but deliberately omits the
// numeric badge — FR-W5 keeps the picker free of per-developer counts so
// the page doesn't have to pre-fetch every workload up front.
export function DeveloperPicker({ roster, selectedLogin, onSelect }: Props) {
  const [focusIdx, setFocusIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (focusIdx >= roster.length) setFocusIdx(Math.max(0, roster.length - 1));
  }, [roster.length, focusIdx]);

  if (roster.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted">
        No developers in the configured roster.
      </p>
    );
  }

  function handleKey(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, roster.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = roster[focusIdx];
      if (m) onSelect(selectedLogin === m.login ? null : m.login);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onSelect(null);
    }
  }

  const focused = roster[focusIdx];

  return (
    <ul
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-activedescendant={focused ? `developer-${focused.login}` : undefined}
      onKeyDown={handleKey}
      className="divide-y divide-line outline-none focus:ring-1 focus:ring-accent"
    >
      {roster.map((m, i) => {
        const isSelected = selectedLogin === m.login;
        const isFocused = i === focusIdx;
        return (
          <li
            key={m.login}
            id={`developer-${m.login}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(isSelected ? null : m.login)}
            className={[
              "flex items-center gap-2 px-3 py-1.5 cursor-pointer",
              "border-l-2",
              isSelected
                ? "bg-accent/10 border-accent"
                : "border-transparent hover:bg-panel2",
              isFocused && !isSelected ? "bg-panel2" : "",
            ].join(" ")}
          >
            <img
              src={m.avatarUrl}
              alt=""
              width={20}
              height={20}
              className="rounded-full shrink-0"
            />
            <span className="text-sm flex-1 truncate text-fg">{m.login}</span>
          </li>
        );
      })}
    </ul>
  );
}
