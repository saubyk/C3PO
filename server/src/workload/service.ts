import { parseWorkloadTeams } from "./config.js";
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
// (malformed WORKLOAD_TEAMS entries) and resolution warnings (unreadable
// teams) are surfaced separately because they have different shapes — the UI
// will render them in the same banner.
export async function loadRoster(
  token: string,
  rawTeamsEnv: string | undefined,
): Promise<RosterResponse> {
  const { teams, errors } = parseWorkloadTeams(rawTeamsEnv);
  const resolved: Roster = await resolveRoster(token, teams);
  return {
    orgs: resolved.orgs,
    roster: resolved.roster,
    warnings: resolved.warnings,
    configErrors: errors,
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
