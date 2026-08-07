import {
  parseWorkloadTeams,
  parseWorkloadOrgs,
} from "../src/workload/config.js";
import { resolveRoster } from "../src/workload/roster.js";
import { getDeveloperWorkload } from "../src/workload/developer.js";
import { loadConfig } from "../src/config/load.js";

async function main(): Promise<void> {
  const login = process.argv[2];
  if (!login) {
    console.error("Usage: npx tsx server/scripts/dump-workload.ts <login>");
    process.exit(2);
  }

  // Same resolution the server uses: environment → config file → repo .env.
  const config = loadConfig();
  for (const warning of config.warnings) console.warn(`[config] ${warning}`);

  const token = config.token;
  if (!token) {
    console.error(
      "GITHUB_TOKEN is not set. Add it to .env, or to a config file (see README).",
    );
    process.exit(2);
  }

  const { teams, errors: teamErrors } = parseWorkloadTeams(
    config.workloadTeams,
  );
  const { orgs: extraOrgs, errors: orgErrors } = parseWorkloadOrgs(
    config.workloadOrgs,
  );
  for (const e of [...teamErrors, ...orgErrors]) console.warn(`[workload] ${e}`);
  if (teams.length === 0 && extraOrgs.length === 0) {
    console.error(
      "No teams or orgs configured. Set WORKLOAD_TEAMS=<org>/<team-slug>,... and/or WORKLOAD_ORGS=<org>,... in .env or your config file.",
    );
    process.exit(2);
  }

  const { orgs: teamOrgs, warnings: rosterWarnings } = await resolveRoster(
    token,
    teams,
  );
  for (const w of rosterWarnings) {
    console.warn(`[workload] team ${w.team}: ${w.reason}`);
  }
  const orgs = Array.from(new Set([...teamOrgs, ...extraOrgs])).sort();
  if (orgs.length === 0) {
    console.error(
      "No orgs resolved — nothing to search. Check team slugs / WORKLOAD_ORGS values and read:org scope.",
    );
    process.exit(1);
  }

  const workload = await getDeveloperWorkload(token, login, orgs);
  for (const w of workload.warnings) {
    console.warn(`[workload] query "${w.query}": ${w.reason}`);
  }

  process.stdout.write(
    JSON.stringify(
      {
        login: workload.login,
        orgs: workload.orgs,
        assigned: workload.assigned,
        reviewing: workload.reviewing,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exit(1);
});
