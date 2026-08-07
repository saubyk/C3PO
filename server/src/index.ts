import { createApp } from "./app.js";
import {
  ConfigFileError,
  describeConfigSources,
  loadConfig,
  type LoadedConfig,
} from "./config/load.js";

// Resolves environment → config file → repo-root .env, and copies .env into
// process.env so PORT / LOG_LEVEL keep working. Must run before either is
// read below.
let config: LoadedConfig;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigFileError) {
    console.error(`[config] ${err.message}`);
    process.exit(1);
  }
  throw err;
}
for (const warning of config.warnings) console.warn(`[config] ${warning}`);

const app = createApp({ config });
const port = Number(process.env.PORT ?? 5173);
const debug = process.env.LOG_LEVEL === "debug";

app.listen(port, () => {
  if (debug) {
    console.log(`[server] listening on http://localhost:${port}`);
    console.log(`[config] ${describeConfigSources(config)}`);
  }
});
