import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseWorkloadTeams } from "../src/workload/config.js";
import { resolveRoster } from "../src/workload/roster.js";
import { getDeveloperWorkload } from "../src/workload/developer.js";

// .env lives at repo root, two levels up from server/scripts/.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../.env") });

async function main(): Promise<void> {
  const login = process.argv[2];
  if (!login) {
    console.error("Usage: npx tsx server/scripts/dump-workload.ts <login>");
    process.exit(2);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is not set. Add it to .env.");
    process.exit(2);
  }

  const { teams, errors } = parseWorkloadTeams(process.env.WORKLOAD_TEAMS);
  for (const e of errors) console.warn(`[workload] ${e}`);
  if (teams.length === 0) {
    console.error(
      "No teams configured. Set WORKLOAD_TEAMS=<org>/<team-slug>,... in .env.",
    );
    process.exit(2);
  }

  const { orgs, warnings: rosterWarnings } = await resolveRoster(token, teams);
  for (const w of rosterWarnings) {
    console.warn(`[workload] team ${w.team}: ${w.reason}`);
  }
  if (orgs.length === 0) {
    console.error(
      "No orgs resolved from WORKLOAD_TEAMS — nothing to search. Check team slugs and read:org scope.",
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
