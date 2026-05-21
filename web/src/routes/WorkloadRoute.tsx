import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { AppOutletContext } from "../App";
import {
  ApiError,
  useDeveloperWorkload,
  useWorkloadRoster,
} from "../api";
import { DeveloperPicker } from "../components/DeveloperPicker";
import {
  WorkloadCharts,
  type ChartMode,
} from "../components/WorkloadCharts";
import { EmptyState } from "../components/EmptyState";
import {
  NetworkErrorBanner,
  RateLimitBanner,
} from "../components/ErrorBanner";
import { C3POLoader } from "../components/C3POLoader";

export default function WorkloadRoute() {
  const { boardSelectedLogin } = useOutletContext<AppOutletContext>();
  const queryClient = useQueryClient();

  const roster = useWorkloadRoster();

  // The picker's selection. Seeded once from the Sprint Board's current
  // selection (FR-W4 carry-over) — afterward it's owned by this route.
  // Carry-over is one-way (FR-W10): we never write back to the AppShell.
  const [selected, setSelected] = useState<string | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [mode, setMode] = useState<ChartMode>("counts");
  const [bannerDismissedAt, setBannerDismissedAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // When the roster arrives, attempt to carry the Sprint Board's selection
  // into the picker. Only do this once per board-login value so a later
  // user-driven change isn't overwritten.
  useEffect(() => {
    if (!roster.data) return;
    if (seededFor === boardSelectedLogin) return;
    setSeededFor(boardSelectedLogin);
    if (!boardSelectedLogin) {
      setSelected(null);
      return;
    }
    const inRoster = roster.data.roster.some(
      (m) => m.login === boardSelectedLogin,
    );
    setSelected(inRoster ? boardSelectedLogin : null);
  }, [roster.data, boardSelectedLogin, seededFor]);

  const workload = useDeveloperWorkload(selected);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const calls: Array<Promise<unknown>> = [
        fetch("/api/workload/roster?refresh=1"),
      ];
      if (selected) {
        calls.push(fetch(`/api/workload/${selected}?refresh=1`));
      }
      await Promise.allSettled(calls);
      await queryClient.invalidateQueries({ queryKey: ["workload"] });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, selected, queryClient]);

  // FR-W4 hint: Sprint Board had a selection but it isn't in the roster.
  // Show this only when the picker is empty *because of* a failed carry-over,
  // i.e. the user hasn't already overridden it.
  const carryOverHint = useMemo(() => {
    if (!roster.data) return null;
    if (!boardSelectedLogin) return null;
    if (seededFor !== boardSelectedLogin) return null;
    if (selected) return null;
    const inRoster = roster.data.roster.some(
      (m) => m.login === boardSelectedLogin,
    );
    if (inRoster) return null;
    return boardSelectedLogin;
  }, [roster.data, boardSelectedLogin, seededFor, selected]);

  const lastUpdated = workload.dataUpdatedAt || roster.dataUpdatedAt;
  const liveError =
    (workload.error as unknown) ?? (roster.error as unknown) ?? null;
  const showErrorBanner =
    !!liveError && (lastUpdated ?? 0) < bannerDismissedAt ? false : !!liveError;

  const hasWarnings =
    !!roster.data &&
    (roster.data.warnings.length > 0 ||
      roster.data.configErrors.length > 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-3 border-b border-line px-4 h-10 bg-panel hud-scanlines shrink-0">
        <span className="text-xs text-muted">
          {roster.data
            ? `${roster.data.roster.length} developer${
                roster.data.roster.length === 1 ? "" : "s"
              } · ${roster.data.orgs.length} org${
                roster.data.orgs.length === 1 ? "" : "s"
              }`
            : roster.isPending
              ? "Loading roster…"
              : ""}
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || !roster.data}
            aria-label="Refresh workload data from GitHub"
            className="inline-flex items-center gap-1 hover:text-fg disabled:opacity-50 disabled:cursor-wait"
          >
            <RefreshCw
              size={12}
              className={refreshing ? "animate-spin" : undefined}
            />
            Refresh
          </button>
          <span>
            Last updated{" "}
            {lastUpdated ? (
              formatHHMM(lastUpdated)
            ) : (
              <span aria-hidden="true">—</span>
            )}
          </span>
        </span>
      </header>

      {showErrorBanner &&
        liveError instanceof ApiError &&
        liveError.status === 429 &&
        liveError.resetAt && (
          <RateLimitBanner
            resetAt={liveError.resetAt}
            onDismiss={() => setBannerDismissedAt(Date.now())}
          />
        )}
      {showErrorBanner &&
        (!(liveError instanceof ApiError) || liveError.status !== 429) && (
          <NetworkErrorBanner
            message={
              liveError instanceof Error
                ? liveError.message
                : "Request failed."
            }
            onRetry={handleRefresh}
            onDismiss={() => setBannerDismissedAt(Date.now())}
          />
        )}

      {hasWarnings && roster.data && (
        <RosterWarningsBanner
          warnings={roster.data.warnings}
          configErrors={roster.data.configErrors}
        />
      )}

      <div className="flex-1 min-h-0 flex">
        <aside className="w-56 shrink-0 border-r border-line overflow-y-auto flex flex-col">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-widest text-accent sticky top-0 bg-panel hud-scanlines z-10">
            Developers
          </div>
          {roster.isPending ? (
            <C3POLoader label="Loading roster" />
          ) : (
            <DeveloperPicker
              roster={roster.data?.roster ?? []}
              selectedLogin={selected}
              onSelect={setSelected}
            />
          )}
        </aside>
        <section className="flex-1 min-h-0 flex flex-col">
          {selected && workload.data ? (
            <WorkloadCharts
              login={workload.data.login}
              assigned={workload.data.assigned}
              reviewing={workload.data.reviewing}
              mode={mode}
              onModeChange={setMode}
            />
          ) : selected && workload.isPending ? (
            <C3POLoader label="Loading workload" />
          ) : (
            <EmptyState
              title="Pick a developer to see their workload distribution."
              detail={
                carryOverHint ? (
                  <>
                    <span className="font-mono">{carryOverHint}</span> isn't in
                    the configured workload roster.
                  </>
                ) : roster.data && roster.data.roster.length === 0 ? (
                  "Set WORKLOAD_TEAMS in .env to populate the roster."
                ) : null
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function RosterWarningsBanner({
  warnings,
  configErrors,
}: {
  warnings: { team: string; reason: string }[];
  configErrors: string[];
}) {
  return (
    <div
      role="status"
      className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs px-4 py-2 shrink-0"
    >
      <p className="font-medium">
        {warnings.length + configErrors.length} issue
        {warnings.length + configErrors.length === 1 ? "" : "s"} with
        WORKLOAD_TEAMS configuration:
      </p>
      <ul className="mt-1 space-y-0.5">
        {configErrors.map((e) => (
          <li key={`cfg-${e}`} className="ml-3 list-disc">
            {e}
          </li>
        ))}
        {warnings.map((w) => (
          <li key={`warn-${w.team}`} className="ml-3 list-disc">
            <span className="font-mono">{w.team}</span>: {w.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatHHMM(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
