import { graphql } from "@octokit/graphql";

export function makeGraphqlClient(token: string) {
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  });
}

export async function fetchViewerLogin(token: string): Promise<string> {
  const client = makeGraphqlClient(token);
  const data = await client<{ viewer: { login: string } }>(
    `query { viewer { login } }`,
  );
  return data.viewer.login;
}
