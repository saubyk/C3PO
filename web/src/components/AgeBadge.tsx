const DAY_MS = 24 * 60 * 60 * 1000;

export function AgeBadge({ updatedAt }: { updatedAt: string | null }) {
  if (!updatedAt) return null;
  const ms = Date.now() - new Date(updatedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;

  const text = ageString(ms);
  const tone = ageTone(ms);

  return (
    <span
      title={`Status last changed ${new Date(updatedAt).toLocaleString()}`}
      className={`font-mono text-[10px] tabular-nums ${tone}`}
    >
      {text}
    </span>
  );
}

function ageString(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  if (days < 1) return "today";
  if (days < 14) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

function ageTone(ms: number): string {
  const days = ms / DAY_MS;
  if (days <= 3) return "text-faint";
  if (days <= 7) return "text-amber";
  return "text-stale";
}
