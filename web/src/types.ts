// Mirrored from server/src/github/projects.ts and server/src/app.ts.
// We don't import across workspaces; if these drift, both sides will be loud.

export type User = {
  login: string;
  name: string | null;
  avatarUrl: string;
};

export type FieldValue =
  | { kind: "single_select"; optionName: string }
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "date"; date: string }
  | { kind: "iteration"; title: string };

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
