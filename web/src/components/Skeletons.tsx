type Props = { count?: number; variant?: "row" | "wide" };

export function SkeletonRows({ count = 6, variant = "row" }: Props) {
  return (
    <div className="divide-y divide-gray-100" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-2 animate-pulse"
        >
          <div className="h-4 w-4 rounded-full bg-gray-200 shrink-0" />
          {variant === "wide" ? (
            <>
              <div className="h-3 w-10 bg-gray-200 rounded shrink-0" />
              <div className="h-3 flex-1 bg-gray-200 rounded" />
              <div className="h-3 w-12 bg-gray-200 rounded shrink-0" />
              <div className="h-3 w-8 bg-gray-200 rounded shrink-0" />
            </>
          ) : (
            <>
              <div className="h-3 flex-1 max-w-[120px] bg-gray-200 rounded" />
              <div className="h-3 w-6 bg-gray-200 rounded shrink-0" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
