import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConfigFileError,
  configFromEnv,
  loadConfig,
  type LoadOptions,
} from "../config/load.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "c3po-config-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Every case pins all three layers explicitly: an unset dotenvPath would read
// the developer's real repo-root .env and make these tests machine-dependent.
function load(opts: Partial<LoadOptions> = {}) {
  return loadConfig({
    env: {},
    homeDir: join(dir, "home"),
    dotenvPath: join(dir, "nonexistent.env"),
    hydrateProcessEnv: false,
    ...opts,
  });
}

function writeConfig(contents: unknown, name = "config.json"): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    typeof contents === "string" ? contents : JSON.stringify(contents),
  );
  return path;
}

function writeDotenv(contents: string): string {
  const path = join(dir, ".env");
  writeFileSync(path, contents);
  return path;
}

describe("precedence", () => {
  it("prefers the environment over the config file and .env", () => {
    const configPath = writeConfig({ githubToken: "from-file" });
    const dotenvPath = writeDotenv("GITHUB_TOKEN=from-dotenv\n");

    const config = load({
      env: { GITHUB_TOKEN: "from-env", C3PO_CONFIG: configPath },
      dotenvPath,
    });

    expect(config.token).toBe("from-env");
    expect(config.sources.token).toBe("environment");
  });

  it("prefers the config file over .env", () => {
    const configPath = writeConfig({ githubToken: "from-file" });
    const dotenvPath = writeDotenv("GITHUB_TOKEN=from-dotenv\n");

    const config = load({ env: { C3PO_CONFIG: configPath }, dotenvPath });

    expect(config.token).toBe("from-file");
    expect(config.sources.token).toBe("config-file");
  });

  it("falls back to .env when no config file exists", () => {
    const dotenvPath = writeDotenv("GITHUB_TOKEN=from-dotenv\n");

    const config = load({ dotenvPath });

    expect(config.token).toBe("from-dotenv");
    expect(config.sources.token).toBe("dotenv");
  });

  it("resolves each field independently", () => {
    const configPath = writeConfig({ githubToken: "from-file" });
    const dotenvPath = writeDotenv("WORKLOAD_TEAMS=org/team-from-dotenv\n");

    const config = load({ env: { C3PO_CONFIG: configPath }, dotenvPath });

    expect(config.token).toBe("from-file");
    expect(config.workloadTeams).toBe("org/team-from-dotenv");
    expect(config.sources).toEqual({
      token: "config-file",
      workloadTeams: "dotenv",
      workloadOrgs: null,
    });
  });

  it("treats a blank value as absent rather than letting it shadow a lower layer", () => {
    const configPath = writeConfig({ workloadTeams: "org/real-team" });
    // .env.example ships exactly this placeholder line.
    const dotenvPath = writeDotenv("WORKLOAD_TEAMS=\n");

    const config = load({
      env: { C3PO_CONFIG: configPath, GITHUB_TOKEN: "   " },
      dotenvPath,
    });

    expect(config.workloadTeams).toBe("org/real-team");
    expect(config.token).toBeNull();
    expect(config.sources.token).toBeNull();
  });

  it("returns a null token when nothing configures one", () => {
    const config = load();
    expect(config.token).toBeNull();
    expect(config.warnings).toEqual([]);
  });
});

describe("config file discovery", () => {
  it("reads $XDG_CONFIG_HOME/c3po/config.json", () => {
    const xdg = join(dir, "xdg");
    mkdirSync(join(xdg, "c3po"), { recursive: true });
    writeFileSync(
      join(xdg, "c3po", "config.json"),
      JSON.stringify({ githubToken: "xdg-token" }),
    );

    const config = load({ env: { XDG_CONFIG_HOME: xdg } });

    expect(config.token).toBe("xdg-token");
    expect(config.configPath).toBe(join(xdg, "c3po", "config.json"));
  });

  it("falls back to ~/.config/c3po/config.json when XDG_CONFIG_HOME is unset", () => {
    const home = join(dir, "home");
    mkdirSync(join(home, ".config", "c3po"), { recursive: true });
    writeFileSync(
      join(home, ".config", "c3po", "config.json"),
      JSON.stringify({ githubToken: "home-token" }),
    );

    const config = load({ homeDir: home });

    expect(config.token).toBe("home-token");
  });

  it("expands ~ in C3PO_CONFIG", () => {
    const home = join(dir, "home");
    mkdirSync(home, { recursive: true });
    writeFileSync(
      join(home, "custom.json"),
      JSON.stringify({ githubToken: "tilde-token" }),
    );

    const config = load({
      env: { C3PO_CONFIG: "~/custom.json" },
      homeDir: home,
    });

    expect(config.token).toBe("tilde-token");
    expect(config.configPath).toBe(join(home, "custom.json"));
  });

  it("ignores a missing config file at the default location", () => {
    expect(() => load()).not.toThrow();
    expect(load().configPath).toBe(join(dir, "home", ".config", "c3po", "config.json"));
  });

  it("fails loudly when C3PO_CONFIG points at a file that isn't there", () => {
    const missing = join(dir, "nope.json");
    expect(() => load({ env: { C3PO_CONFIG: missing } })).toThrow(
      ConfigFileError,
    );
    expect(() => load({ env: { C3PO_CONFIG: missing } })).toThrow(
      /no file there/i,
    );
  });
});

describe("config file parsing", () => {
  it("rejects malformed JSON", () => {
    const path = writeConfig("{ not json");
    expect(() => load({ env: { C3PO_CONFIG: path } })).toThrow(
      /not valid JSON/i,
    );
  });

  it("rejects a top-level value that isn't an object", () => {
    const path = writeConfig(["a", "b"]);
    expect(() => load({ env: { C3PO_CONFIG: path } })).toThrow(
      /must contain a JSON object/i,
    );
  });

  it("rejects a non-string githubToken", () => {
    const path = writeConfig({ githubToken: 42 });
    expect(() => load({ env: { C3PO_CONFIG: path } })).toThrow(
      /"githubToken".*must be a string/i,
    );
  });

  it("joins array-valued workloadTeams into the comma form the parser expects", () => {
    const path = writeConfig({
      workloadTeams: ["org-a/team-one", "org-b/team-two"],
      workloadOrgs: ["vendor-org"],
    });

    const config = load({ env: { C3PO_CONFIG: path } });

    expect(config.workloadTeams).toBe("org-a/team-one,org-b/team-two");
    expect(config.workloadOrgs).toBe("vendor-org");
  });

  it("accepts the comma-separated string form too", () => {
    const path = writeConfig({ workloadTeams: "org-a/team-one,org-b/team-two" });
    expect(load({ env: { C3PO_CONFIG: path } }).workloadTeams).toBe(
      "org-a/team-one,org-b/team-two",
    );
  });

  it("rejects an array containing non-strings", () => {
    const path = writeConfig({ workloadOrgs: ["ok", 7] });
    expect(() => load({ env: { C3PO_CONFIG: path } })).toThrow(
      /only strings/i,
    );
  });

  it("warns about an unknown key instead of failing", () => {
    const path = writeConfig({ githubToken: "t", workloadTeam: "typo/here" });
    chmodSync(path, 0o600);

    const config = load({ env: { C3PO_CONFIG: path } });

    expect(config.token).toBe("t");
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/unknown key "workloadTeam"/i);
  });
});

describe("githubTokenFile — secret in its own file", () => {
  function writeSecret(contents: string, name = "token"): string {
    const path = join(dir, name);
    writeFileSync(path, contents);
    chmodSync(path, 0o600);
    return path;
  }

  it("reads the token from the file the config file points at", () => {
    const secret = writeSecret("ghp_from_secret_file\n");
    const configPath = writeConfig({ githubTokenFile: secret });
    chmodSync(configPath, 0o600);

    const config = load({ env: { C3PO_CONFIG: configPath } });

    expect(config.token).toBe("ghp_from_secret_file");
    expect(config.sources.token).toBe("config-file");
    expect(config.tokenPath).toBe(secret);
  });

  it("strips the trailing newline that `echo > file` leaves behind", () => {
    const secret = writeSecret("  ghp_padded  \n\n");
    const configPath = writeConfig({ githubTokenFile: secret });

    expect(load({ env: { C3PO_CONFIG: configPath } }).token).toBe("ghp_padded");
  });

  it("resolves a relative pointer against the config file's own directory", () => {
    writeSecret("ghp_sibling\n", "secret-next-door");
    // Deliberately not relative to CWD — the config file is the anchor.
    const configPath = writeConfig({ githubTokenFile: "secret-next-door" });

    const config = load({ env: { C3PO_CONFIG: configPath } });

    expect(config.token).toBe("ghp_sibling");
    expect(config.tokenPath).toBe(join(dir, "secret-next-door"));
  });

  it("expands ~ in the pointer", () => {
    const home = join(dir, "home");
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "tok"), "ghp_from_home\n");
    const configPath = writeConfig({ githubTokenFile: "~/tok" });

    expect(
      load({ env: { C3PO_CONFIG: configPath }, homeDir: home }).token,
    ).toBe("ghp_from_home");
  });

  it("follows GITHUB_TOKEN_FILE from the environment", () => {
    const secret = writeSecret("ghp_from_env_pointer\n");

    const config = load({ env: { GITHUB_TOKEN_FILE: secret } });

    expect(config.token).toBe("ghp_from_env_pointer");
    expect(config.sources.token).toBe("environment");
  });

  it("follows GITHUB_TOKEN_FILE from .env", () => {
    const secret = writeSecret("ghp_from_dotenv_pointer\n");
    const dotenvPath = writeDotenv(`GITHUB_TOKEN_FILE=${secret}\n`);

    const config = load({ dotenvPath });

    expect(config.token).toBe("ghp_from_dotenv_pointer");
    expect(config.sources.token).toBe("dotenv");
  });

  it("lets a higher layer's inline token beat a lower layer's pointer", () => {
    const secret = writeSecret("ghp_from_file\n");
    const configPath = writeConfig({ githubTokenFile: secret });

    const config = load({
      env: { GITHUB_TOKEN: "ghp_from_env", C3PO_CONFIG: configPath },
    });

    expect(config.token).toBe("ghp_from_env");
    expect(config.tokenPath).toBeNull();
  });

  it("prefers an inline token over a pointer in the same layer, and says so", () => {
    const secret = writeSecret("ghp_from_file\n");
    const configPath = writeConfig({
      githubToken: "ghp_inline",
      githubTokenFile: secret,
    });
    chmodSync(configPath, 0o600);

    const config = load({ env: { C3PO_CONFIG: configPath } });

    expect(config.token).toBe("ghp_inline");
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/using the inline token/i);
  });

  it("fails loudly rather than silently falling through to a lower layer", () => {
    // The danger this guards against: a typo'd pointer quietly authenticating
    // you as whoever .env's token belongs to.
    const dotenvPath = writeDotenv("GITHUB_TOKEN=ghp_from_dotenv\n");
    const configPath = writeConfig({
      githubTokenFile: join(dir, "typo-not-here"),
    });

    expect(() =>
      load({ env: { C3PO_CONFIG: configPath }, dotenvPath }),
    ).toThrow(/no file there/i);
  });

  it("rejects an empty token file", () => {
    const secret = writeSecret("\n  \n");
    const configPath = writeConfig({ githubTokenFile: secret });

    expect(() => load({ env: { C3PO_CONFIG: configPath } })).toThrow(
      /is empty/i,
    );
  });

  it("rejects a multi-line file — the classic 'pointed it at .env' mistake", () => {
    const secret = writeSecret(
      "GITHUB_TOKEN=ghp_oops\nWORKLOAD_TEAMS=org/team\n",
    );
    const configPath = writeConfig({ githubTokenFile: secret });

    expect(() => load({ env: { C3PO_CONFIG: configPath } })).toThrow(
      /only the token/i,
    );
  });

  it("warns about the secret file's permissions, not the settings file's", () => {
    const secret = writeSecret("ghp_exposed\n");
    chmodSync(secret, 0o644);
    // Settings file stays readable on purpose — that's the point of the split.
    const configPath = writeConfig({ githubTokenFile: secret });
    chmodSync(configPath, 0o644);

    const config = load({ env: { C3PO_CONFIG: configPath } });

    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toContain(secret);
    expect(config.warnings[0]).not.toContain(configPath);
  });

  it("stays quiet when the settings file is loose but the secret is locked down", () => {
    const secret = writeSecret("ghp_safe\n");
    const configPath = writeConfig({ githubTokenFile: secret });
    chmodSync(configPath, 0o644);

    expect(load({ env: { C3PO_CONFIG: configPath } }).warnings).toEqual([]);
  });
});

describe("token file permissions", () => {
  it("warns when a config file holding a token is readable by others", () => {
    const path = writeConfig({ githubToken: "secret" });
    chmodSync(path, 0o644);

    const config = load({ env: { C3PO_CONFIG: path } });

    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/readable by other users/i);
    expect(config.warnings[0]).toMatch(/chmod 600/);
  });

  it("stays quiet when the file is locked down", () => {
    const path = writeConfig({ githubToken: "secret" });
    chmodSync(path, 0o600);

    expect(load({ env: { C3PO_CONFIG: path } }).warnings).toEqual([]);
  });

  it("does not warn when the file carries no token", () => {
    const path = writeConfig({ workloadOrgs: ["some-org"] });
    chmodSync(path, 0o644);

    expect(load({ env: { C3PO_CONFIG: path } }).warnings).toEqual([]);
  });
});

// The only tests here that touch global state. Snapshot and restore the exact
// keys involved so neither the rest of this file nor a later run can be
// affected by what they set.
describe("process.env hydration", () => {
  const TOUCHED = ["PORT", "C3PO_TEST_ONLY"] as const;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));
    for (const k of TOUCHED) delete process.env[k];
  });

  afterEach(() => {
    for (const k of TOUCHED) {
      const prior = saved[k];
      if (prior === undefined) delete process.env[k];
      else process.env[k] = prior;
    }
  });

  it("copies non-C3PO .env settings into process.env without overriding", () => {
    const dotenvPath = writeDotenv("PORT=9999\nC3PO_TEST_ONLY=from-dotenv\n");
    process.env.PORT = "1234";

    load({ dotenvPath, hydrateProcessEnv: true });

    expect(process.env.PORT).toBe("1234");
    expect(process.env.C3PO_TEST_ONLY).toBe("from-dotenv");
  });

  it("leaves process.env alone when hydration is off", () => {
    const dotenvPath = writeDotenv("C3PO_TEST_ONLY=from-dotenv\n");

    load({ dotenvPath });

    expect(process.env.C3PO_TEST_ONLY).toBeUndefined();
  });
});

describe("configFromEnv", () => {
  it("reads the environment without touching the filesystem", () => {
    expect(
      configFromEnv({ GITHUB_TOKEN: "t", WORKLOAD_TEAMS: "org/team" }),
    ).toEqual({
      token: "t",
      workloadTeams: "org/team",
      workloadOrgs: undefined,
    });
  });

  it("maps a blank token to null", () => {
    expect(configFromEnv({ GITHUB_TOKEN: "" }).token).toBeNull();
  });
});
