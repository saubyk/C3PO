import { EmptyState } from "../components/EmptyState";

export default function WorkloadRoute() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <EmptyState
        title="Workload — UI in M10"
        detail="The /api/workload/roster and /api/workload/:login endpoints are live. The visualization-first dashboard lands in the next milestone."
      />
    </div>
  );
}
