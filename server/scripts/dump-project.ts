import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getProjectItems } from "../src/github/projects.js";

// .env lives at repo root, two levels up from server/scripts/.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../.env") });

async function main(): Promise<void> {
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
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is not set. Add it to .env.");
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
