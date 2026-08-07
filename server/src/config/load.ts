import dotenv from "dotenv";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Where C3PO's settings come from, highest precedence first:
//
//   1. the real process environment  (GITHUB_TOKEN=… npm start, CI, tests)
//   2. a JSON config file            ($C3PO_CONFIG, else $XDG_CONFIG_HOME/c3po/config.json)
//   3. <repo>/.env                   (the original location; still supported)
//
// The point of layer 2 is that the token doesn't have to live inside the
// checkout: one config file can sit anywhere on disk and serve several
// clones. Layer 3 is kept so existing setups keep working untouched.
//
// Resolution is per-field, so a config file can hold the token while .env
// still sets WORKLOAD_TEAMS, or vice versa.
//
// The token can be given inline (githubToken / GITHUB_TOKEN) or as a pointer
// to a file that contains nothing but the secret (githubTokenFile /
// GITHUB_TOKEN_FILE). The pointer form keeps the secret out of the settings
// file entirely, so the settings can be readable while the secret stays 0600.

export class ConfigFileError extends Error {}

/** The settings the server actually consumes. */
export type AppConfig = {
  token: string | null;
  // Left as raw comma-separated strings so workload/config.ts keeps doing all
  // the validation and error reporting, whatever layer the value came from.
  workloadTeams: string | undefined;
  workloadOrgs: string | undefined;
};

export type ValueOrigin = "environment" | "config-file" | "dotenv";

export type LoadedConfig = AppConfig & {
  /** The config file that was read, if any (absolute). */
  configPath: string | null;
  /** The .env that was read, if any (absolute). */
  dotenvPath: string | null;
  /** The separate secret file the token was read from, if any (absolute). */
  tokenPath: string | null;
  sources: {
    token: ValueOrigin | null;
    workloadTeams: ValueOrigin | null;
    workloadOrgs: ValueOrigin | null;
  };
  /** Non-fatal problems worth printing at boot. */
  warnings: string[];
};

export type LoadOptions = {
  /** Environment to resolve from. Read before .env is applied. */
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  /** Overrides the repo-root .env location. */
  dotenvPath?: string;
  /**
   * Whether to copy .env values into process.env (without overriding what's
   * already there) so non-C3PO settings like PORT and LOG_LEVEL keep working.
   * Always disable this in tests.
   */
  hydrateProcessEnv?: boolean;
};

const CONFIG_BASENAME = join("c3po", "config.json");
const KNOWN_KEYS = new Set([
  "githubToken",
  "githubTokenFile",
  "workloadTeams",
  "workloadOrgs",
]);

/**
 * Resolve configuration from the environment, a config file, and .env.
 *
 * Throws ConfigFileError for problems the user must fix before the app can
 * work at all (an explicitly-pointed-at file that isn't there, malformed
 * JSON, wrong value types). A merely *absent* token is not an error here —
 * it surfaces per-request as a 500, same as it always has.
 */
export function loadConfig(opts: LoadOptions = {}): LoadedConfig {
  const env = opts.env ?? process.env;
  const home = opts.homeDir ?? homedir();
  const warnings: string[] = [];

  const location = locateConfigFile(env, home);
  const fromFile = location ? readConfigFile(location, warnings) : {};

  const dotenvPath = opts.dotenvPath ?? defaultDotenvPath();
  const fromDotenv = parseDotenv(dotenvPath);

  const token = resolveToken(
    [
      {
        source: "environment",
        inline: env.GITHUB_TOKEN,
        pointer: env.GITHUB_TOKEN_FILE,
        // A pointer from the environment is relative to where you launched.
        baseDir: process.cwd(),
        label: "GITHUB_TOKEN / GITHUB_TOKEN_FILE",
      },
      {
        source: "config-file",
        inline: fromFile.githubToken,
        pointer: fromFile.githubTokenFile,
        // A pointer inside the config file is relative to that file, so a
        // settings file and its secret can sit next to each other.
        baseDir: location ? dirname(location.path) : process.cwd(),
        label: `"githubToken" / "githubTokenFile" in ${location?.path ?? "the config file"}`,
      },
      {
        source: "dotenv",
        inline: fromDotenv.GITHUB_TOKEN,
        pointer: fromDotenv.GITHUB_TOKEN_FILE,
        baseDir: dirname(dotenvPath),
        label: `GITHUB_TOKEN / GITHUB_TOKEN_FILE in ${dotenvPath}`,
      },
    ],
    home,
    warnings,
  );
  const workloadTeams = pick([
    ["environment", env.WORKLOAD_TEAMS],
    ["config-file", fromFile.workloadTeams],
    ["dotenv", fromDotenv.WORKLOAD_TEAMS],
  ]);
  const workloadOrgs = pick([
    ["environment", env.WORKLOAD_ORGS],
    ["config-file", fromFile.workloadOrgs],
    ["dotenv", fromDotenv.WORKLOAD_ORGS],
  ]);

  // Nag about whichever file actually ended up holding the secret.
  if (token.tokenPath) {
    warnIfWorldReadable(token.tokenPath, warnings);
  } else if (token.source === "config-file" && location) {
    warnIfWorldReadable(location.path, warnings);
  }

  if (opts.hydrateProcessEnv !== false) {
    for (const [key, value] of Object.entries(fromDotenv)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }

  return {
    token: token.value ?? null,
    workloadTeams: workloadTeams.value,
    workloadOrgs: workloadOrgs.value,
    configPath: location?.path ?? null,
    dotenvPath: Object.keys(fromDotenv).length > 0 ? dotenvPath : null,
    tokenPath: token.tokenPath,
    sources: {
      token: token.source,
      workloadTeams: workloadTeams.source,
      workloadOrgs: workloadOrgs.source,
    },
    warnings,
  };
}

/**
 * Config straight from the environment, with no filesystem access at all.
 * This is what createApp() falls back to, which is what keeps the app
 * unit-testable without a config file on disk anywhere. Because it does no
 * I/O it deliberately does *not* follow GITHUB_TOKEN_FILE — following a
 * pointer is loadConfig()'s job, and every boot path goes through that.
 */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    token: clean(env.GITHUB_TOKEN) ?? null,
    workloadTeams: clean(env.WORKLOAD_TEAMS),
    workloadOrgs: clean(env.WORKLOAD_ORGS),
  };
}

/** A one-line summary of where each setting came from, for the debug log. */
export function describeConfigSources(config: LoadedConfig): string {
  const token = config.sources.token ?? "(unset)";
  const parts = [
    `token=${config.tokenPath ? `${token} → ${config.tokenPath}` : token}`,
  ];
  if (config.configPath) parts.push(`config file=${config.configPath}`);
  if (config.dotenvPath) parts.push(`dotenv=${config.dotenvPath}`);
  return parts.join(" · ");
}

// --- token ---

type TokenLayer = {
  source: ValueOrigin;
  inline: string | undefined;
  pointer: string | undefined;
  /** Relative pointers resolve against this. */
  baseDir: string;
  /** How to name this layer in messages. */
  label: string;
};

type ResolvedToken = {
  value: string | undefined;
  source: ValueOrigin | null;
  tokenPath: string | null;
};

// Walks the layers in order; within a layer an inline token wins over a
// pointer, because the inline one is the more specific thing to have set.
function resolveToken(
  layers: TokenLayer[],
  home: string,
  warnings: string[],
): ResolvedToken {
  for (const layer of layers) {
    const inline = clean(layer.inline);
    const pointer = clean(layer.pointer);
    if (inline && pointer) {
      warnings.push(
        `Both an inline token and a token file are set via ${layer.label}; using the inline token and ignoring "${pointer}".`,
      );
    }
    if (inline) {
      return { value: inline, source: layer.source, tokenPath: null };
    }
    if (pointer) {
      const path = expandPath(pointer, home, layer.baseDir);
      return {
        value: readTokenFile(path, layer.label),
        source: layer.source,
        tokenPath: path,
      };
    }
  }
  return { value: undefined, source: null, tokenPath: null };
}

// A pointer that can't be followed is always fatal: the user named a specific
// file, and silently falling through to a lower layer would be a confusing
// way to end up authenticated as someone else.
function readTokenFile(path: string, label: string): string {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (isNotFound(err)) {
      throw new ConfigFileError(
        `${label} points at ${path}, but there is no file there.`,
      );
    }
    throw new ConfigFileError(
      `Could not read token file ${path}: ${messageOf(err)}`,
    );
  }
  // The file is expected to hold nothing but the secret; trimming makes
  // `echo "$TOKEN" > file` work, which is how people will create it.
  const token = raw.trim();
  if (!token) {
    throw new ConfigFileError(`Token file ${path} is empty.`);
  }
  if (/\s/.test(token)) {
    throw new ConfigFileError(
      `Token file ${path} should contain only the token, but has whitespace inside it.`,
    );
  }
  return token;
}

// --- layers ---

type Layer = [ValueOrigin, string | undefined];

function pick(
  layers: Layer[],
): { value: string | undefined; source: ValueOrigin | null } {
  for (const [source, raw] of layers) {
    const value = clean(raw);
    if (value !== undefined) return { value, source };
  }
  return { value: undefined, source: null };
}

// Blank counts as absent so a placeholder line (`WORKLOAD_TEAMS=` as shipped
// in .env.example) doesn't shadow a real value in a lower layer.
function clean(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type ConfigLocation = { path: string; explicit: boolean };

function locateConfigFile(
  env: NodeJS.ProcessEnv,
  home: string,
): ConfigLocation | null {
  const cwd = process.cwd();
  const explicit = clean(env.C3PO_CONFIG);
  if (explicit) {
    return { path: expandPath(explicit, home, cwd), explicit: true };
  }
  const base = clean(env.XDG_CONFIG_HOME) ?? join(home, ".config");
  return {
    path: join(expandPath(base, home, cwd), CONFIG_BASENAME),
    explicit: false,
  };
}

type FileValues = {
  githubToken?: string;
  githubTokenFile?: string;
  workloadTeams?: string;
  workloadOrgs?: string;
};

function readConfigFile(
  location: ConfigLocation,
  warnings: string[],
): FileValues {
  let raw: string;
  try {
    raw = readFileSync(location.path, "utf8");
  } catch (err) {
    // A missing file is only an error when the user pointed us at it.
    if (isNotFound(err)) {
      if (!location.explicit) return {};
      throw new ConfigFileError(
        `C3PO_CONFIG points at ${location.path}, but there is no file there.`,
      );
    }
    throw new ConfigFileError(
      `Could not read config file ${location.path}: ${messageOf(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigFileError(
      `Config file ${location.path} is not valid JSON: ${messageOf(err)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConfigFileError(
      `Config file ${location.path} must contain a JSON object.`,
    );
  }

  const obj = parsed as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!KNOWN_KEYS.has(key)) {
      warnings.push(
        `Unknown key "${key}" in ${location.path} (ignored). Expected one of: ${[...KNOWN_KEYS].join(", ")}.`,
      );
    }
  }

  return {
    githubToken: readString(obj, "githubToken", location.path),
    githubTokenFile: readString(obj, "githubTokenFile", location.path),
    workloadTeams: readList(obj, "workloadTeams", location.path),
    workloadOrgs: readList(obj, "workloadOrgs", location.path),
  };
}

function readString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") {
    throw new ConfigFileError(
      `"${key}" in ${path} must be a string, got ${describeType(v)}.`,
    );
  }
  return v;
}

// Accepts either a list or the comma-separated string form used by .env, so
// the file can be written whichever way reads better.
function readList(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const entry of v) {
      if (typeof entry !== "string") {
        throw new ConfigFileError(
          `"${key}" in ${path} must contain only strings, got ${describeType(entry)}.`,
        );
      }
    }
    return v.join(",");
  }
  throw new ConfigFileError(
    `"${key}" in ${path} must be a string or an array of strings, got ${describeType(v)}.`,
  );
}

function parseDotenv(path: string): Record<string, string> {
  try {
    return dotenv.parse(readFileSync(path));
  } catch {
    // No .env is a perfectly normal setup now that a config file can carry
    // everything; an unreadable one shouldn't take the server down either.
    return {};
  }
}

function warnIfWorldReadable(path: string, warnings: string[]): void {
  try {
    const mode = statSync(path).mode & 0o777;
    if (mode & 0o077) {
      warnings.push(
        `${path} holds a GitHub token but is readable by other users on this machine (mode ${mode.toString(8)}). Consider: chmod 600 ${path}`,
      );
    }
  } catch {
    // We already read the file; a failing stat isn't worth reporting.
  }
}

// --- paths ---

// Resolves to <repo>/.env from either server/src/config/ or server/dist/config/.
function defaultDotenvPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../.env");
}

// Expands a leading ~ (the shell won't have, inside a config value) and
// resolves anything relative against baseDir.
function expandPath(p: string, home: string, baseDir: string): string {
  if (p === "~") return home;
  if (p.startsWith("~/")) return join(home, p.slice(2));
  return resolve(baseDir, p);
}

// --- misc ---

function isNotFound(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { code?: string }).code === "ENOENT"
  );
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function describeType(v: unknown): string {
  if (v === null) return "null";
  return Array.isArray(v) ? "an array" : `a ${typeof v}`;
}
