type DismissProps = { onDismiss: () => void };

export function RateLimitBanner({
  resetAt,
  onDismiss,
}: { resetAt: string } & DismissProps) {
  const time = formatTime(resetAt);
  return (
    <div
      role="alert"
      className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs px-4 py-2 flex items-center gap-3 shrink-0"
    >
      <span className="font-medium">GitHub rate limit hit.</span>
      <span>Resets at {time}.</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss rate-limit banner"
        className="ml-auto text-amber-300 hover:text-amber-100 font-bold leading-none"
      >
        ×
      </button>
    </div>
  );
}

export function NetworkErrorBanner({
  message,
  onRetry,
  onDismiss,
}: { message: string; onRetry: () => void } & DismissProps) {
  return (
    <div
      role="alert"
      className="bg-red-500/10 border-b border-red-500/30 text-red-200 text-xs px-4 py-2 flex items-center gap-3 shrink-0"
    >
      <span className="font-medium">Couldn’t reach GitHub.</span>
      <span className="truncate">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="ml-auto px-2 py-0.5 rounded border border-red-500/40 hover:bg-red-500/20 text-red-100"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss network-error banner"
        className="text-red-300 hover:text-red-100 font-bold leading-none"
      >
        ×
      </button>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}
