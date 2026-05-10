import { Octokit } from "@octokit/rest";
import type { WorkloadTeam } from "./config.js";

export type RosterUser = {
  login: string;
  avatarUrl: string;
};

export type RosterWarning = {
  team: string;
  reason: string;
};

export type Roster = {
  orgs: string[];
  roster: RosterUser[];
  warnings: RosterWarning[];
};

export async function resolveRoster(
  token: string,
  teams: WorkloadTeam[],
): Promise<Roster> {
  if (teams.length === 0) {
    return { orgs: [], roster: [], warnings: [] };
  }

  const octokit = new Octokit({ auth: token });
  const warnings: RosterWarning[] = [];
  const orgSet = new Set<string>();
  const memberMap = new Map<string, RosterUser>();

  const results = await Promise.allSettled(
    teams.map((t) =>
      octokit.paginate(octokit.rest.teams.listMembersInOrg, {
        org: t.org,
        team_slug: t.slug,
        per_page: 100,
      }),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const team = teams[i];
    if (!team || !r) continue;
    const label = `${team.org}/${team.slug}`;
    if (r.status === "rejected") {
      const reason =
        r.reason instanceof Error
          ? r.reason.message
          : String(r.reason ?? "unknown error");
      warnings.push({ team: label, reason });
      continue;
    }
    orgSet.add(team.org);
    for (const m of r.value) {
      if (!m.login) continue;
      if (!memberMap.has(m.login)) {
        memberMap.set(m.login, {
          login: m.login,
          avatarUrl: m.avatar_url,
        });
      }
    }
  }

  const roster = Array.from(memberMap.values()).sort((a, b) =>
    a.login.localeCompare(b.login),
  );
  const orgs = Array.from(orgSet).sort();

  return { orgs, roster, warnings };
}
