import type { User } from "../types";

export function Avatar({ user, size = 16 }: { user: User; size?: number }) {
  return (
    <img
      src={user.avatarUrl}
      alt={user.login}
      title={user.name ?? user.login}
      width={size}
      height={size}
      className="rounded-full shrink-0"
    />
  );
}
