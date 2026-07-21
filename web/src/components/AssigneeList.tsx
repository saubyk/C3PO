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
    return (
      <p className="px-3.5 py-2 font-mono text-[11px] text-faint uppercase">
        No team members.
      </p>
    );
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
      className="outline-none focus:ring-1 focus:ring-accent"
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
              "flex items-center gap-2.5 pl-3 pr-3.5 py-[7px] cursor-pointer",
              "border-l-2",
              isSelected
                ? "bg-accent/9 border-gold"
                : "border-transparent hover:bg-accent/7",
              isFocused && !isSelected ? "bg-accent/5" : "",
            ].join(" ")}
          >
            <Avatar user={m} size={22} />
            <span
              className={[
                "text-[13px] font-medium flex-1 truncate",
                isSelected ? "text-fg" : "text-body",
              ].join(" ")}
            >
              {m.login}
            </span>
            <span className="font-mono text-[10.5px] text-faint tabular-nums shrink-0">
              {total}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
