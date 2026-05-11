// Mirrored from server/src/github/projects.ts and server/src/app.ts.
// We don't import across workspaces; if these drift, both sides will be loud.

export type User = {
  login: string;
  name: string | null;
  avatarUrl: string;
};

type FieldValueData =
  | { kind: "single_select"; optionName: string }
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "date"; date: string }
  | { kind: "iteration"; title: string };

// `updatedAt` is when this field was last changed for this item — e.g. when
// Status moved from Backlog to In progress. Used by the UI to surface stale
// items.
export type FieldValue = FieldValueData & { updatedAt: string | null };

export type ProjectItem = {
  id: string;
  contentType: "Issue" | "PullRequest";
  number: number;
  title: string;
  url: string;
  state: string;
  assignees: User[];
  requestedReviewers: User[];
  fields: Record<string, FieldValue>;
};

export type TeamMember = User & {
  assignedCount: number;
  reviewingCount: number;
};

export type ProjectSummary = {
  owner: string;
  number: number;
  title: string;
  url: string;
};

// --- Workload (v0.2) ---

export type RosterUser = {
  login: string;
  avatarUrl: string;
};

export type RosterWarning = {
  team: string;
  reason: string;
};

export type RosterResponse = {
  orgs: string[];
  roster: RosterUser[];
  warnings: RosterWarning[];
  configErrors: string[];
};

export type WorkloadItem = {
  kind: "Issue" | "PullRequest";
  repo: string;
  number: number;
  title: string;
  url: string;
};

export type WorkloadWarning = {
  query: string;
  reason: string;
};

export type WorkloadResponse = {
  login: string;
  orgs: string[];
  assigned: WorkloadItem[];
  reviewing: WorkloadItem[];
  warnings: WorkloadWarning[];
};
