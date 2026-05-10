import type { TeamMember } from "../types";
import { Avatar } from "./Avatar";

export function AssigneeList({ team }: { team: TeamMember[] }) {
  if (team.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-500">No team members.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {team.map((m) => {
        const total = m.assignedCount + m.reviewingCount;
        return (
          <li
            key={m.login}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
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
