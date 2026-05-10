import { graphql } from "@octokit/graphql";

export type RepoCount = {
  repo: string;
  count: number;
};

export type WorkloadWarning = {
  query: string;
  reason: string;
};

export type DeveloperWorkload = {
  login: string;
  orgs: string[];
  assigned: RepoCount[];
  reviewing: RepoCount[];
  warnings: WorkloadWarning[];
};

// GitHub's search API caps results at 1000 per query, even with pagination.
// If a developer's open work exceeds this in a single org, the counts will
// undercount and we surface a warning.
const SEARCH_CAP = 1000;

const SEARCH_QUERY = `
  query Search($q: String!, $cursor: String) {
    search(query: $q, type: ISSUE, first: 100, after: $cursor) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename
        ... on Issue { repository { nameWithOwner } }
        ... on PullRequest { repository { nameWithOwner } }
      }
    }
  }
`;

type SearchNode =
  | { __typename: "Issue"; repository: { nameWithOwner: string } }
  | { __typename: "PullRequest"; repository: { nameWithOwner: string } }
  | { __typename: string };

type SearchResponse = {
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: SearchNode[];
  };
};

type SearchResult = {
  counts: Map<string, number>;
  capped: boolean;
};

function makeClient(token: string) {
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  });
}

async function searchByRepo(
  client: ReturnType<typeof makeClient>,
  q: string,
): Promise<SearchResult> {
  const counts = new Map<string, number>();
  let cursor: string | null = null;
  let totalSeen = 0;
  let capped = false;

  while (true) {
    const data: SearchResponse = await client(SEARCH_QUERY, { q, cursor });
    if (data.search.issueCount > SEARCH_CAP) capped = true;
    for (const node of data.search.nodes) {
      if (
        (node.__typename === "Issue" || node.__typename === "PullRequest") &&
        "repository" in node
      ) {
        const repo = node.repository.nameWithOwner;
        counts.set(repo, (counts.get(repo) ?? 0) + 1);
        totalSeen += 1;
      }
    }
    if (!data.search.pageInfo.hasNextPage) break;
    if (totalSeen >= SEARCH_CAP) {
      capped = true;
      break;
    }
    cursor = data.search.pageInfo.endCursor;
  }

  return { counts, capped };
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
  ): Promise<RepoCount[]> => {
    const queries = orgs.map((org) =>
      kind === "assigned"
        ? `is:open assignee:${login} org:${org}`
        : `is:pr is:open review-requested:${login} org:${org}`,
    );

    const results = await Promise.allSettled(
      queries.map((q) => searchByRepo(client, q)),
    );

    const merged = new Map<string, number>();
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
          reason: `search returned more than ${SEARCH_CAP} results; counts may be undercounted`,
        });
      }
      for (const [repo, count] of r.value.counts) {
        merged.set(repo, (merged.get(repo) ?? 0) + count);
      }
    }

    return Array.from(merged.entries())
      .map(([repo, count]) => ({ repo, count }))
      .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo));
  };

  const [assigned, reviewing] = await Promise.all([
    runKind("assigned"),
    runKind("reviewing"),
  ]);

  return { login, orgs, assigned, reviewing, warnings };
}
