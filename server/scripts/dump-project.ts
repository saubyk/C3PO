import { getProjectItems } from "../src/github/projects.js";
import { loadConfig } from "../src/config/load.js";

async function main(): Promise<void> {
  // Same resolution the server uses: environment → config file → repo .env.
  const config = loadConfig();
  for (const warning of config.warnings) console.warn(`[config] ${warning}`);

  const owner = process.argv[2];
  const numStr = process.argv[3];
  if (!owner || !numStr) {
    console.error(
      "Usage: npx tsx server/scripts/dump-project.ts <owner> <projectNumber>",
    );
    process.exit(2);
  }
  const projectNumber = Number(numStr);
  if (!Number.isInteger(projectNumber) || projectNumber <= 0) {
    console.error(`Invalid project number: ${numStr}`);
    process.exit(2);
  }
  const token = config.token;
  if (!token) {
    console.error(
      "GITHUB_TOKEN is not set. Add it to .env, or to a config file (see README).",
    );
    process.exit(2);
  }

  const items = await getProjectItems(token, owner, projectNumber);
  process.stdout.write(JSON.stringify(items, null, 2) + "\n");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exit(1);
});
