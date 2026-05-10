import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { TeamMember } from "../types";
import { Avatar } from "./Avatar";

type Props = {
  team: TeamMember[];
  selectedLogin: string | null;
  onSelect: (login: string | null) => void;
};

export function AssigneeList({ team, selectedLogin, onSelect }: Props) {
  const [focusIdx, setFocusIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep focusIdx in bounds when team list changes (filters narrow it).
  useEffect(() => {
    if (focusIdx >= team.length) setFocusIdx(Math.max(0, team.length - 1));
  }, [team.length, focusIdx]);

  if (team.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-500">No team members.</p>;
  }

  function handleKey(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, team.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = team[focusIdx];
      if (m) onSelect(selectedLogin === m.login ? null : m.login);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onSelect(null);
    }
  }

  const focused = team[focusIdx];

  return (
    <ul
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-activedescendant={focused ? `assignee-${focused.login}` : undefined}
      onKeyDown={handleKey}
      className="divide-y divide-gray-100 outline-none focus:ring-1 focus:ring-blue-300"
    >
      {team.map((m, i) => {
        const total = m.assignedCount + m.reviewingCount;
        const isSelected = selectedLogin === m.login;
        const isFocused = i === focusIdx;
        return (
          <li
            key={m.login}
            id={`assignee-${m.login}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(isSelected ? null : m.login)}
            className={[
              "flex items-center gap-2 px-3 py-1.5 cursor-pointer",
              "border-l-2",
              isSelected
                ? "bg-blue-50 border-blue-500"
                : "border-transparent hover:bg-gray-50",
              isFocused && !isSelected ? "bg-gray-50" : "",
            ].join(" ")}
          >
            <Avatar user={m} size={20} />
            <span className="text-sm flex-1 truncate">{m.login}</span>
            <span className="text-xs text-gray-500 tabular-nums shrink-0">
              {total}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
