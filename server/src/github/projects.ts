import { graphql } from "@octokit/graphql";
import { NotFoundError } from "../errors.js";

// --- Public types ---

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

// `updatedAt` is when this *specific field* was last changed for this item —
// e.g. when Status moved from Backlog to In progress. Used by the UI to
// surface stale items.
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

export type ProjectSummary = {
  owner: string;
  number: number;
  title: string;
  url: string;
};

// --- Raw GraphQL response shapes ---

type RawUser = { login: string; name: string | null; avatarUrl: string };

type RawFieldValue = {
  __typename: string;
  name?: string;
  text?: string;
  number?: number;
  date?: string;
  title?: string;
  updatedAt?: string;
  field?: { name?: string } | null;
};

type RawIssueOrPR = {
  __typename: string;
  id: string;
  number: number;
  title: string;
  url: string;
  state: string;
  assignees: { nodes: RawUser[] };
  reviewRequests?: {
    nodes: Array<{
      requestedReviewer:
        | (RawUser & { __typename: string })
        | { __typename: string }
        | null;
    }>;
  };
};

type RawProjectItem = {
  id: string;
  type: string;
  fieldValues: { nodes: RawFieldValue[] };
  content: RawIssueOrPR | { __typename: string } | null;
};

type ProjectNode = {
  number: number;
  title: string;
  url: string;
  closed: boolean;
};

type ProjectsConnection = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: ProjectNode[];
};

type ViewerProjectsResponse = {
  viewer: {
    login: string;
    projectsV2: ProjectsConnection;
  };
};

type ViewerOrgsResponse = {
  viewer: {
    organizations: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{ login: string }>;
    };
  };
};

type OrgProjectsResponse = {
  organization: { projectsV2: ProjectsConnection } | null;
};

type ProjectItemsResponse = {
  repositoryOwner:
    | null
    | {
        __typename: string;
        projectV2: {
          id: string;
          title: string;
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: RawProjectItem[];
          };
        } | null;
      };
};

// --- Queries ---

const VIEWER_PROJECTS_QUERY = `
  query ViewerProjects($cursor: String) {
    viewer {
      login
      projectsV2(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { number title url closed }
      }
    }
  }
`;

const VIEWER_ORGS_QUERY = `
  query ViewerOrgs($cursor: String) {
    viewer {
      organizations(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { login }
      }
    }
  }
`;

const ORG_PROJECTS_QUERY = `
  query OrgProjects($owner: String!, $cursor: String) {
    organization(login: $owner) {
      projectsV2(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { number title url closed }
      }
    }
  }
`;

const PROJECT_ITEMS_QUERY = `
  query ProjectItems($owner: String!, $number: Int!, $cursor: String) {
    repositoryOwner(login: $owner) {
      __typename
      ... on Organization {
        projectV2(number: $number) { ...projectItemsFields }
      }
      ... on User {
        projectV2(number: $number) { ...projectItemsFields }
      }
    }
  }

  fragment projectItemsFields on ProjectV2 {
    id
    title
    items(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        type
        fieldValues(first: 20) {
          nodes {
            __typename
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              updatedAt
              field { ... on ProjectV2FieldCommon { name } }
            }
            ... on ProjectV2ItemFieldTextValue {
              text
              updatedAt
              field { ... on ProjectV2FieldCommon { name } }
            }
            ... on ProjectV2ItemFieldNumberValue {
              number
              updatedAt
              field { ... on ProjectV2FieldCommon { name } }
            }
            ... on ProjectV2ItemFieldDateValue {
              date
              updatedAt
              field { ... on ProjectV2FieldCommon { name } }
            }
            ... on ProjectV2ItemFieldIterationValue {
              title
              updatedAt
              field { ... on ProjectV2FieldCommon { name } }
            }
          }
        }
        content {
          __typename
          ... on Issue {
            id
            number
            title
            url
            state
            assignees(first: 10) { nodes { login name avatarUrl } }
          }
          ... on PullRequest {
            id
            number
            title
            url
            state
            assignees(first: 10) { nodes { login name avatarUrl } }
            reviewRequests(first: 10) {
              nodes {
                requestedReviewer {
                  __typename
                  ... on User { login name avatarUrl }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// --- Client ---

function makeClient(token: string) {
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  });
}

// --- Public API ---

export async function listProjects(token: string): Promise<ProjectSummary[]> {
  const client = makeClient(token);
  const out: ProjectSummary[] = [];

  // 1. Viewer's identity + personal projects.
  let viewerLogin = "";
  let cursor: string | null = null;
  while (true) {
    const data: ViewerProjectsResponse = await client(VIEWER_PROJECTS_QUERY, {
      cursor,
    });
    viewerLogin = data.viewer.login;
    for (const p of data.viewer.projectsV2.nodes) {
      if (!p.closed) {
        out.push({
          owner: viewerLogin,
          number: p.number,
          title: p.title,
          url: p.url,
        });
      }
    }
    if (!data.viewer.projectsV2.pageInfo.hasNextPage) break;
    cursor = data.viewer.projectsV2.pageInfo.endCursor;
  }

  // 2. Orgs the viewer belongs to.
  const orgLogins: string[] = [];
  cursor = null;
  while (true) {
    const data: ViewerOrgsResponse = await client(VIEWER_ORGS_QUERY, {
      cursor,
    });
    for (const org of data.viewer.organizations.nodes) {
      orgLogins.push(org.login);
    }
    if (!data.viewer.organizations.pageInfo.hasNextPage) break;
    cursor = data.viewer.organizations.pageInfo.endCursor;
  }

  // 3. Per-org projects, in parallel. Skip orgs we can't read with a warning
  // rather than failing the whole list.
  const results = await Promise.allSettled(
    orgLogins.map((login) => fetchOrgProjects(client, login)),
  );
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r?.status === "fulfilled") {
      out.push(...r.value);
    } else if (r?.status === "rejected") {
      const reason =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.warn(
        `[projects] could not list projects for org ${orgLogins[i]}: ${reason}`,
      );
    }
  }

  return out;
}

async function fetchOrgProjects(
  client: ReturnType<typeof makeClient>,
  owner: string,
): Promise<ProjectSummary[]> {
  const out: ProjectSummary[] = [];
  let cursor: string | null = null;
  while (true) {
    const data: OrgProjectsResponse = await client(ORG_PROJECTS_QUERY, {
      owner,
      cursor,
    });
    if (!data.organization) return out;
    for (const p of data.organization.projectsV2.nodes) {
      if (!p.closed) {
        out.push({ owner, number: p.number, title: p.title, url: p.url });
      }
    }
    if (!data.organization.projectsV2.pageInfo.hasNextPage) break;
    cursor = data.organization.projectsV2.pageInfo.endCursor;
  }
  return out;
}

export async function getProjectItems(
  token: string,
  owner: string,
  projectNumber: number,
): Promise<ProjectItem[]> {
  const client = makeClient(token);
  const out: ProjectItem[] = [];
  let cursor: string | null = null;
  while (true) {
    const data: ProjectItemsResponse = await client(PROJECT_ITEMS_QUERY, {
      owner,
      number: projectNumber,
      cursor,
    });
    if (!data.repositoryOwner) {
      throw new NotFoundError(`Owner not found on github.com: ${owner}`);
    }
    const project = data.repositoryOwner.projectV2;
    if (!project) {
      throw new NotFoundError(
        `Project #${projectNumber} not found for owner ${owner}.`,
      );
    }
    for (const node of project.items.nodes) {
      const resolved = resolveItem(node);
      if (resolved) out.push(resolved);
    }
    if (!project.items.pageInfo.hasNextPage) break;
    cursor = project.items.pageInfo.endCursor;
  }
  return out;
}

// --- Resolution ---

function resolveItem(node: RawProjectItem): ProjectItem | null {
  if (!node.content) {
    console.warn(
      `[projects] skipping item ${node.id}: content unavailable (type=${node.type})`,
    );
    return null;
  }
  const tn = node.content.__typename;
  if (tn !== "Issue" && tn !== "PullRequest") {
    console.warn(
      `[projects] skipping item ${node.id}: content type is ${tn} (not Issue or PullRequest)`,
    );
    return null;
  }
  const c = node.content as RawIssueOrPR;
  const requestedReviewers: User[] =
    tn === "PullRequest"
      ? (c.reviewRequests?.nodes ?? [])
          .map((rr) => rr.requestedReviewer)
          .filter(
            (rr): rr is RawUser & { __typename: string } =>
              !!rr && rr.__typename === "User" && "login" in rr,
          )
          .map(toUser)
      : [];
  return {
    id: node.id,
    contentType: tn,
    number: c.number,
    title: c.title,
    url: c.url,
    state: c.state,
    assignees: c.assignees.nodes.map(toUser),
    requestedReviewers,
    fields: extractFields(node.fieldValues.nodes),
  };
}

function toUser(u: RawUser): User {
  return { login: u.login, name: u.name, avatarUrl: u.avatarUrl };
}

function extractFields(
  nodes: RawFieldValue[],
): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const fv of nodes) {
    const fieldName = fv.field?.name;
    if (!fieldName) continue;
    const updatedAt = fv.updatedAt ?? null;
    switch (fv.__typename) {
      case "ProjectV2ItemFieldSingleSelectValue":
        if (fv.name) {
          out[fieldName] = {
            kind: "single_select",
            optionName: fv.name,
            updatedAt,
          };
        }
        break;
      case "ProjectV2ItemFieldTextValue":
        if (fv.text != null) {
          out[fieldName] = { kind: "text", text: fv.text, updatedAt };
        }
        break;
      case "ProjectV2ItemFieldNumberValue":
        if (fv.number != null) {
          out[fieldName] = {
            kind: "number",
            number: fv.number,
            updatedAt,
          };
        }
        break;
      case "ProjectV2ItemFieldDateValue":
        if (fv.date) {
          out[fieldName] = { kind: "date", date: fv.date, updatedAt };
        }
        break;
      case "ProjectV2ItemFieldIterationValue":
        if (fv.title) {
          out[fieldName] = {
            kind: "iteration",
            title: fv.title,
            updatedAt,
          };
        }
        break;
      // Other field types (Labels, Users, Milestone, etc.) intentionally
      // ignored; add cases here when a new field type is needed.
    }
  }
  return out;
}
