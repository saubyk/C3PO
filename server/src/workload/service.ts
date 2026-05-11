import { parseWorkloadTeams, parseWorkloadOrgs } from "./config.js";
import {
  resolveRoster,
  type Roster,
  type RosterUser,
  type RosterWarning,
} from "./roster.js";
import {
  getDeveloperWorkload,
  type DeveloperWorkload,
  type RepoCount,
  type WorkloadWarning,
} from "./developer.js";

export type RosterResponse = {
  orgs: string[];
  roster: RosterUser[];
  warnings: RosterWarning[];
  configErrors: string[];
};

export type WorkloadResponse = {
  login: string;
  orgs: string[];
  assigned: RepoCount[];
  reviewing: RepoCount[];
  warnings: WorkloadWarning[];
};

// Returns the resolved roster plus any config parse errors. Config errors
// (malformed WORKLOAD_TEAMS / WORKLOAD_ORGS entries) and resolution warnings
// (unreadable teams) are surfaced separately because they have different
// shapes — the UI will render them in the same banner.
//
// WORKLOAD_ORGS widens the search scope only: its orgs are unioned with the
// orgs derived from WORKLOAD_TEAMS, so workload searches can cover orgs
// where the token can read repos but not team membership.
export async function loadRoster(
  token: string,
  rawTeamsEnv: string | undefined,
  rawOrgsEnv: string | undefined,
): Promise<RosterResponse> {
  const { teams, errors: teamErrors } = parseWorkloadTeams(rawTeamsEnv);
  const { orgs: extraOrgs, errors: orgErrors } = parseWorkloadOrgs(rawOrgsEnv);
  const resolved: Roster = await resolveRoster(token, teams);
  const mergedOrgs = Array.from(
    new Set([...resolved.orgs, ...extraOrgs]),
  ).sort();
  return {
    orgs: mergedOrgs,
    roster: resolved.roster,
    warnings: resolved.warnings,
    configErrors: [...teamErrors, ...orgErrors],
  };
}

// Per-developer workload, scoped to the orgs passed in. Caller typically
// passes orgs from the cached roster response so we don't re-resolve teams
// on every workload request.
export async function loadDeveloperWorkload(
  token: string,
  login: string,
  orgs: string[],
): Promise<WorkloadResponse> {
  const wl: DeveloperWorkload = await getDeveloperWorkload(token, login, orgs);
  return {
    login: wl.login,
    orgs: wl.orgs,
    assigned: wl.assigned,
    reviewing: wl.reviewing,
    warnings: wl.warnings,
  };
}
