export type WorkloadTeam = {
  org: string;
  slug: string;
};

export type ParsedWorkloadTeams = {
  teams: WorkloadTeam[];
  errors: string[];
};

// Org logins follow GitHub's existing constraint: alphanumeric + hyphens,
// up to 39 chars. Team slugs are more permissive (underscores, dots).
const ORG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseWorkloadTeams(
  raw: string | undefined,
): ParsedWorkloadTeams {
  const teams: WorkloadTeam[] = [];
  const errors: string[] = [];
  if (!raw) return { teams, errors };

  const entries = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const entry of entries) {
    const parts = entry.split("/");
    if (parts.length !== 2) {
      errors.push(
        `Invalid WORKLOAD_TEAMS entry: "${entry}" (expected "org/team-slug").`,
      );
      continue;
    }
    const org = (parts[0] ?? "").trim();
    const slug = (parts[1] ?? "").trim();
    if (!org || !slug) {
      errors.push(
        `Invalid WORKLOAD_TEAMS entry: "${entry}" (org and team-slug must be non-empty).`,
      );
      continue;
    }
    if (!ORG_RE.test(org)) {
      errors.push(`Invalid org in WORKLOAD_TEAMS entry: "${entry}".`);
      continue;
    }
    if (!SLUG_RE.test(slug)) {
      errors.push(`Invalid team slug in WORKLOAD_TEAMS entry: "${entry}".`);
      continue;
    }
    teams.push({ org, slug });
  }

  return { teams, errors };
}
