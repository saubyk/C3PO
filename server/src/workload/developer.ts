import { graphql } from "@octokit/graphql";

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

export type DeveloperWorkload = {
  login: string;
  orgs: string[];
  assigned: WorkloadItem[];
  reviewing: WorkloadItem[];
  warnings: WorkloadWarning[];
};

// GitHub's search API caps results at 1000 per query, even with pagination.
// If a developer's open work exceeds this in a single org, the item list
// will be truncated and we surface a warning.
const SEARCH_CAP = 1000;

const SEARCH_QUERY = `
  query Search($q: String!, $cursor: String) {
    search(query: $q, type: ISSUE, first: 100, after: $cursor) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename
        ... on Issue {
          number
          title
          url
          repository { nameWithOwner }
        }
        ... on PullRequest {
          number
          title
          url
          repository { nameWithOwner }
        }
      }
    }
  }
`;

type ItemFields = {
  number: number;
  title: string;
  url: string;
  repository: { nameWithOwner: string };
};

type SearchNode =
  | ({ __typename: "Issue" } & ItemFields)
  | ({ __typename: "PullRequest" } & ItemFields)
  | { __typename: string };

type SearchResponse = {
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: SearchNode[];
  };
};

type SearchResult = {
  items: WorkloadItem[];
  capped: boolean;
};

function makeClient(token: string) {
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  });
}

async function searchItems(
  client: ReturnType<typeof makeClient>,
  q: string,
): Promise<SearchResult> {
  const items: WorkloadItem[] = [];
  let cursor: string | null = null;
  let capped = false;

  while (true) {
    const data: SearchResponse = await client(SEARCH_QUERY, { q, cursor });
    if (data.search.issueCount > SEARCH_CAP) capped = true;
    for (const node of data.search.nodes) {
      if (
        (node.__typename === "Issue" || node.__typename === "PullRequest") &&
        "repository" in node
      ) {
        items.push({
          kind: node.__typename,
          repo: node.repository.nameWithOwner,
          number: node.number,
          title: node.title,
          url: node.url,
        });
      }
    }
    if (!data.search.pageInfo.hasNextPage) break;
    if (items.length >= SEARCH_CAP) {
      capped = true;
      break;
    }
    cursor = data.search.pageInfo.endCursor;
  }

  return { items, capped };
}

export async function getDeveloperWorkload(
  token: string,
  login: string,
  orgs: string[],
): Promise<DeveloperWorkload> {
  const client = makeClient(token);
  const warnings: WorkloadWarning[] = [];

  const runKind = async (
    kind: "assigned" | "reviewing",
  ): Promise<WorkloadItem[]> => {
    const queries = orgs.map((org) =>
      kind === "assigned"
        ? `is:open assignee:${login} org:${org}`
        : `is:pr is:open review-requested:${login} org:${org}`,
    );

    const results = await Promise.allSettled(
      queries.map((q) => searchItems(client, q)),
    );

    const merged: WorkloadItem[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const q = queries[i] ?? "";
      if (!r) continue;
      if (r.status === "rejected") {
        const reason =
          r.reason instanceof Error
            ? r.reason.message
            : String(r.reason ?? "unknown error");
        warnings.push({ query: q, reason });
        continue;
      }
      if (r.value.capped) {
        warnings.push({
          query: q,
          reason: `search returned more than ${SEARCH_CAP} results; the list may be truncated`,
        });
      }
      merged.push(...r.value.items);
    }

    // Sort by repo then number for a stable order. The UI groups by repo for
    // the drill-down view, so a stable per-repo ordering keeps results
    // predictable across refreshes.
    merged.sort(
      (a, b) => a.repo.localeCompare(b.repo) || a.number - b.number,
    );
    return merged;
  };

  const [assigned, reviewing] = await Promise.all([
    runKind("assigned"),
    runKind("reviewing"),
  ]);

  return { login, orgs, assigned, reviewing, warnings };
}
