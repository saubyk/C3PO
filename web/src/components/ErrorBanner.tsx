type DismissProps = { onDismiss: () => void };

export function RateLimitBanner({
  resetAt,
  onDismiss,
}: { resetAt: string } & DismissProps) {
  const time = formatTime(resetAt);
  return (
    <div
      role="alert"
      className="bg-amber/10 border-b border-amber/30 text-amber font-mono text-[11px] uppercase tracking-[.04em] px-4 py-2 flex items-center gap-3 shrink-0"
    >
      <span className="font-semibold">GITHUB RATE LIMIT HIT.</span>
      <span>RESETS AT {time}.</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss rate-limit banner"
        className="ml-auto text-amber hover:text-fg font-bold leading-none"
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
      className="bg-red/10 border-b border-red/30 text-red font-mono text-[11px] px-4 py-2 flex items-center gap-3 shrink-0"
    >
      <span className="font-semibold uppercase tracking-[.04em]">
        Couldn’t reach GitHub.
      </span>
      <span className="truncate">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="ml-auto px-2 py-0.5 rounded border border-red/40 hover:bg-red/20 uppercase tracking-[.04em] whitespace-nowrap"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss network-error banner"
        className="text-red hover:text-fg font-bold leading-none"
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
