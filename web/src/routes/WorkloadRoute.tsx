import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import { PaneHeader } from "../components/PaneHeader";
import { SubToolbar, SyncCluster, ToolbarLabel } from "../components/Toolbar";
import {
  NetworkErrorBanner,
  RateLimitBanner,
} from "../components/ErrorBanner";
import { C3POLoader } from "../components/C3POLoader";

export default function WorkloadRoute() {
  const { boardSelectedLogin, setStatusMeta } =
    useOutletContext<AppOutletContext>();
  const queryClient = useQueryClient();

  const roster = useWorkloadRoster();

  // The picker's selection. Seeded once from the Sprint Board's current
  // selection (FR-W4 carry-over) — afterward it's owned by this route.
  // Carry-over is one-way (FR-W10): we never write back to the AppShell.
  // There is no dead landing state: when the carry-over fails or the board
  // had no selection, the first roster member is auto-selected.
  const [selected, setSelected] = useState<string | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [mode, setMode] = useState<ChartMode>("counts");
  const [bannerDismissedAt, setBannerDismissedAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!roster.data) return;
    const first = roster.data.roster[0]?.login ?? null;
    if (seededFor !== boardSelectedLogin) {
      setSeededFor(boardSelectedLogin);
      const inRoster =
        !!boardSelectedLogin &&
        roster.data.roster.some((m) => m.login === boardSelectedLogin);
      setSelected(inRoster ? boardSelectedLogin : first);
      return;
    }
    // Covers roster arriving with nothing to seed from (or a deselection).
    if (!selected && first) setSelected(first);
  }, [roster.data, boardSelectedLogin, seededFor, selected]);

  const workload = useDeveloperWorkload(selected);

  // Feed the status footer: org count + roster size.
  useEffect(() => {
    setStatusMeta({
      sector: roster.data ? `${roster.data.orgs.length} ORGS` : null,
      lifeforms: roster.data?.roster.length ?? null,
    });
  }, [setStatusMeta, roster.data]);

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
      <SubToolbar>
        <ToolbarLabel>
          {roster.data
            ? `${roster.data.roster.length} DEVELOPERS · ${roster.data.orgs.length} ${
                roster.data.orgs.length === 1 ? "ORG" : "ORGS"
              }`
            : roster.isPending
              ? "SCANNING ROSTER…"
              : ""}
        </ToolbarLabel>
        <span className="ml-auto flex items-center gap-3">
          <span
            className="inline-flex border border-line2 rounded overflow-hidden font-mono text-[10px] uppercase tracking-[.06em]"
            role="group"
            aria-label="Chart value mode"
          >
            <ModeButton
              active={mode === "counts"}
              onClick={() => setMode("counts")}
              label="Counts"
            />
            <ModeButton
              active={mode === "percentages"}
              onClick={() => setMode("percentages")}
              label="%"
            />
          </span>
          <SyncCluster
            lastUpdated={lastUpdated || undefined}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            refreshDisabled={!roster.data}
            refreshLabel="Refresh workload data from GitHub"
          />
        </span>
      </SubToolbar>

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
        <aside className="w-[236px] shrink-0 border-r border-line bg-panel flex flex-col min-h-0">
          <PaneHeader
            title="Developers"
            count={roster.data?.roster.length}
            countLabel="TRACKED"
          />
          {roster.isPending ? (
            <C3POLoader label="Loading roster" />
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0">
              <DeveloperPicker
                roster={roster.data?.roster ?? []}
                selectedLogin={selected}
                onSelect={setSelected}
              />
            </div>
          )}
        </aside>
        <section className="flex-1 min-h-0 flex flex-col">
          {selected && workload.data ? (
            <WorkloadCharts
              login={workload.data.login}
              assigned={workload.data.assigned}
              reviewing={workload.data.reviewing}
              mode={mode}
            />
          ) : selected || roster.isPending ? (
            <C3POLoader label="Loading workload" />
          ) : (
            <EmptyState
              title="NO LIFEFORMS ON SCANNER."
              detail="Set WORKLOAD_TEAMS in .env to populate the roster."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "px-2.5 py-1",
        active
          ? "bg-accent/15 text-accent"
          : "text-faint hover:text-fg",
      ].join(" ")}
    >
      {label}
    </button>
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
      className="bg-amber/10 border-b border-amber/30 text-amber font-mono text-[11px] px-4 py-2 shrink-0"
    >
      <p className="font-semibold uppercase tracking-[.04em]">
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
