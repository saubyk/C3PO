# C3PO

A local web app that reorganizes a GitHub Project (v2) board around team
**members** instead of items. GitHub's native board answers "what is the state
of every item." This tool answers "for each person on the team, what are they
building, and what are they reviewing?"

Two tabs:

- **Sprint Board** — three columns scoped to one Projects v2 board: assignees
  on the left, items assigned to the selected person in the middle, PRs
  they're requested to review on the right. Click an assignee to drill in;
  click again or press `Esc` to clear.
- **Workload** — visualization-first dashboard for a curated team roster.
  Pick a developer, see two pie charts of their open work distributed
  across every repo in the configured org(s). Useful for spotting workload
  imbalance that the per-board view can't show.

Single-user tool. Runs on your laptop, reads from `github.com` via a Personal
Access Token in a local `.env`. Read-only — never writes to GitHub.

<img width="1646" height="959" alt="image" src="https://github.com/user-attachments/assets/0633c283-5f6b-4874-9bc6-4f9dde6b8915" />



## Quick start

```bash
git clone https://github.com/saubyk/C3PO.git
cd C3PO
cp .env.example .env
# open .env and paste your GitHub token (instructions below)
npm install
npm start
```

Open <http://localhost:3263>. Pick a project from the dropdown in the header.
The app remembers your selection across reloads.

## Generating a GitHub token

1. Go to <https://github.com/settings/tokens/new> (classic Personal Access
   Tokens — fine-grained PATs work too but the scopes are more involved).
2. Name it something memorable like `c3po-local` and pick an expiration
   (90 days is GitHub's default).
3. Tick these scopes:
   - **`read:project`** — required. Projects v2 fields (Status, Priority,
     Size, item lists) only exist in the GraphQL API behind this scope.
   - **`repo`** — required if any project you want to browse references
     **private** repos. Use `public_repo` instead if every repo is public.
   - **`read:org`** — required so the app can enumerate the organizations
     you belong to and surface their Projects v2 boards. Also required by
     the Workload tab to resolve team membership for every org listed in
     `WORKLOAD_TEAMS`.
   - **`read:user`** — optional, safe to include.
4. Do **not** tick any `write:*`, `delete:*`, or `admin:*` scopes. C3PO is
   strictly read-only.
5. Generate the token and paste it into `.env` as `GITHUB_TOKEN=...`.
6. **SSO note.** If your org enforces SAML SSO, after creating the token
   click "Configure SSO" next to it on
   <https://github.com/settings/tokens> and authorize it for that org.
   Otherwise org-scoped queries will return 401.

The token is the only configuration the app needs. On boot, C3PO calls
`viewer { login organizations { … } }` and discovers every Projects v2 board
you can read across your personal account and every org you belong to.

## Where configuration lives

`.env` in the repo root is the simplest option, but the token doesn't have to
live inside the checkout. Settings are resolved from three layers, highest
precedence first:

| # | Source | Notes |
|---|---|---|
| 1 | The process environment | `GITHUB_TOKEN=… npm start`, CI, one-offs. |
| 2 | A JSON config file | `$C3PO_CONFIG`, else `$XDG_CONFIG_HOME/c3po/config.json`, else `~/.config/c3po/config.json`. |
| 3 | `<repo>/.env` | The original location; still fully supported. |

Resolution is **per setting**, so a config file can hold the token while
`.env` still sets `WORKLOAD_TEAMS`, or the other way round. A blank value
(`WORKLOAD_TEAMS=`) counts as unset and falls through to the next layer.

The config file is JSON, and it can either hold the token inline or **point
at a separate file containing nothing but the secret**:

```json
{
  "githubTokenFile": "~/.secrets/c3po-token",
  "workloadTeams": ["lightningnetwork/lnd-maintainers"],
  "workloadOrgs": ["other-org"]
}
```

Keeping the secret in its own file is the recommended setup: settings and
secret have different sensitivities, so the settings file can stay ordinary
while the token file alone is locked down.

```bash
mkdir -p ~/.config/c3po ~/.secrets

printf '%s\n' 'ghp_xxxxxxxxxxxxxxxxxxxx' > ~/.secrets/c3po-token
chmod 600 ~/.secrets/c3po-token

$EDITOR ~/.config/c3po/config.json      # the JSON above
npm start
```

Details worth knowing:

- `githubTokenFile` may be absolute, start with `~`, or be **relative to the
  config file itself** — so `"githubTokenFile": "token"` finds a secret
  sitting next to `config.json`.
- The token file must contain the token and nothing else. Trailing newlines
  are trimmed, so `printf '%s\n' "$TOKEN" > file` works; a multi-line file is
  rejected rather than sent to GitHub as a malformed token.
- `GITHUB_TOKEN_FILE` does the same thing from the environment or `.env`, if
  you'd rather not have a config file at all.
- To keep everything in one place instead, use `"githubToken": "ghp_…"`
  inline and `chmod 600` the config file. If both are set, the inline token
  wins and a warning tells you the pointer was ignored.

`workloadTeams` and `workloadOrgs` accept either an array or the same
comma-separated string `.env` uses. Unknown keys are ignored with a warning
on stdout, so a typo doesn't silently do nothing.

Put the config anywhere you like and point at it with:

```bash
export C3PO_CONFIG=/Volumes/keys/c3po.json
```

Whichever file ends up holding the token gets a `chmod 600` nudge at boot if
other users on the machine can read it. If `C3PO_CONFIG` or a token pointer
names a file that isn't there, or the JSON is malformed, the server refuses
to start and says why — silently falling back to a different token would be a
confusing way to end up authenticated as someone else.

Run with `npm run start:debug` to see which layer each setting came from:

```
[config] token=config-file → /Users/you/.secrets/c3po-token · config file=/Users/you/.config/c3po/config.json
```

## Workload tab (optional)

The Workload tab is an additional view that complements the Sprint Board. It
shows where a developer's open work is distributed across the team's repos,
regardless of which project board (if any) those issues and PRs live on.

To enable it, add a `WORKLOAD_TEAMS` entry to `.env` (or `workloadTeams` to
your config file) listing one or more GitHub teams in `org/team-slug` form:

```bash
WORKLOAD_TEAMS=lightningnetwork/lnd-maintainers,lightninglabs/some-team
```

On boot, the server resolves each team to its current GitHub members; their
union is the roster shown in the Workload tab's left rail. For the selected
developer, the server runs `is:open assignee:<login>` and
`is:open is:pr review-requested:<login>` searches scoped to the configured
orgs and aggregates the results to per-repo counts that drive two pie charts.

Carry-over: if you've selected a teammate on the Sprint Board, switching to
the Workload tab pre-selects them in the picker (when they're a roster
member). The carry-over is one-way and in-session — picking a different
developer on the Workload tab does not change the Sprint Board's selection,
and a page reload clears the carry-over.

Leave `WORKLOAD_TEAMS` blank to keep the Workload tab as an empty placeholder
without affecting the Sprint Board.

If your team members also contribute to orgs where your token can read repos
but can't read team membership, set `WORKLOAD_ORGS` to widen the search:

```bash
WORKLOAD_ORGS=other-org,vendor-org
```

These orgs are unioned with the ones derived from `WORKLOAD_TEAMS` and added
to the workload search scope. The roster is unchanged — `WORKLOAD_ORGS` only
widens where each developer's open work is searched, not who appears in it.

## Architecture

```
┌─────────────────┐  proxy  ┌─────────────────┐    GraphQL     ┌────────────┐
│ Vite dev :3263  │ ──────► │ Express :5173   │ ─────────────► │ github.com │
│ React + Tailwind│         │ Octokit GraphQL │                │            │
└─────────────────┘         └─────────────────┘                └────────────┘
       browser                     server                          remote
```

- **Two workspaces** under npm workspaces: `server/` and `web/`.
- **Server** runs on `:5173`, exposes `/api/projects`, `/api/projects/:owner/:number/items`, `/api/projects/:owner/:number/team`, `/api/workload/roster`, `/api/workload/:login`, `/api/health`. Caches responses in-memory for 90 s; `?refresh=1` bypasses.
- **Browser** runs on `:3263`. Vite proxies `/api/*` to the server, so the
  browser never sees `GITHUB_TOKEN`.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Runs server (`:5173`) and Vite dev (`:3263`) together. |
| `npm run typecheck` | Typechecks both workspaces. |
| `npm test --workspace=server` | Runs vitest against the API layer. |
| `npx tsx server/scripts/dump-project.ts <owner> <number>` | Dumps a single project's items as JSON. Useful for debugging the data layer without the UI. |
| `npx tsx server/scripts/dump-workload.ts <login>` | Dumps a developer's per-repo workload counts as JSON. Reads `WORKLOAD_TEAMS` from `.env`. |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `/api/projects` returns `[]`. | Token lacks `read:project` for any owner you can see, OR you genuinely have no Projects v2 boards. Check the token's scopes and SSO authorization. |
| `/api/health` returns 401. | `GITHUB_TOKEN` is missing, expired, or misspelled. `npm run start:debug` prints which layer the token came from. |
| A token you just set is being ignored. | A higher-precedence layer is winning — an exported `GITHUB_TOKEN` beats the config file, which beats `.env`. `npm run start:debug` shows which one won. |
| Server exits at boot with `[config] …`. | `C3PO_CONFIG` points at a missing file, or the config file is malformed JSON / has a wrongly-typed value. |
| Rate-limit banner. | The 5 000-req/hr GraphQL budget is exhausted. The banner shows when it resets; the cache will reduce calls considerably once it warms back up. |
| Empty middle/right columns after picking a project. | The default Status filter is `Hide Done`. Try the Status dropdown → `All`. |
| `EADDRINUSE :::5173`. | A previous `npm start` is still running. `pkill -f "tsx watch src/index.ts"` and try again. |

## Status / scope

v0.2 — single-user, local, read-only. v0.1 shipped the Sprint Board; v0.2
adds the Workload tab. See `docs/sprint-board-requirements.md` for the full
requirements and `docs/sprint-board-implementation-plan.md` for the
milestone-by-milestone plan.

Out of scope: editing project fields, drill-down from a pie slice into
individual issues/PRs, multi-developer side-by-side comparison, multi-tenant
hosting, Slack notifications.

## License

MIT — see `LICENSE`.
