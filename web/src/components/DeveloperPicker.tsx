import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { RosterUser } from "../types";

type Props = {
  roster: RosterUser[];
  selectedLogin: string | null;
  onSelect: (login: string | null) => void;
};

// Visually consistent with AssigneeList but deliberately omits the numeric
// badge — FR-W5 keeps the picker free of per-developer counts so the page
// doesn't have to pre-fetch every workload up front.
export function DeveloperPicker({ roster, selectedLogin, onSelect }: Props) {
  const [focusIdx, setFocusIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (focusIdx >= roster.length) setFocusIdx(Math.max(0, roster.length - 1));
  }, [roster.length, focusIdx]);

  if (roster.length === 0) {
    return (
      <p className="px-3.5 py-2 font-mono text-[11px] text-faint uppercase">
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
      className="outline-none focus:ring-1 focus:ring-accent"
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
              "flex items-center gap-2.5 pl-3 pr-3.5 py-[7px] cursor-pointer",
              "border-l-2",
              isSelected
                ? "bg-[rgba(86,200,245,.09)] border-gold"
                : "border-transparent hover:bg-[rgba(86,200,245,.07)]",
              isFocused && !isSelected ? "bg-[rgba(86,200,245,.05)]" : "",
            ].join(" ")}
          >
            <img
              src={m.avatarUrl}
              alt=""
              width={22}
              height={22}
              className="rounded-full shrink-0"
            />
            <span
              className={[
                "text-[13px] font-medium flex-1 truncate",
                isSelected ? "text-fg" : "text-body",
              ].join(" ")}
            >
              {m.login}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
