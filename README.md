# C3PO

A local web app that reorganizes a GitHub Project (v2) board around team
**members** instead of items. GitHub's native board answers "what is the state
of every item." This tool answers "for each person on the team, what are they
building, and what are they reviewing?"

Three columns: assignees on the left, items assigned to the selected person
in the middle, PRs they're requested to review on the right. Click an
assignee to drill in; click again or press `Esc` to clear.

Single-user tool. Runs on your laptop, reads from `github.com` via a Personal
Access Token in a local `.env`. Read-only — never writes to GitHub.

<!-- TODO(m6): drop a screenshot at docs/screenshot.png and reference it here. -->

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
     you belong to and surface their Projects v2 boards.
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

## Architecture

```
┌─────────────────┐  proxy  ┌─────────────────┐    GraphQL     ┌────────────┐
│ Vite dev :3263  │ ──────► │ Express :5173   │ ─────────────► │ github.com │
│ React + Tailwind│         │ Octokit GraphQL │                │            │
└─────────────────┘         └─────────────────┘                └────────────┘
       browser                     server                          remote
```

- **Two workspaces** under npm workspaces: `server/` and `web/`.
- **Server** runs on `:5173`, exposes `/api/projects`, `/api/projects/:owner/:number/items`, `/api/projects/:owner/:number/team`, `/api/health`. Caches responses in-memory for 90 s; `?refresh=1` bypasses.
- **Browser** runs on `:3263`. Vite proxies `/api/*` to the server, so the
  browser never sees `GITHUB_TOKEN`.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Runs server (`:5173`) and Vite dev (`:3263`) together. |
| `npm run typecheck` | Typechecks both workspaces. |
| `npm test --workspace=server` | Runs vitest against the API layer. |
| `npx tsx server/scripts/dump-project.ts <owner> <number>` | Dumps a single project's items as JSON. Useful for debugging the data layer without the UI. |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `/api/projects` returns `[]`. | Token lacks `read:project` for any owner you can see, OR you genuinely have no Projects v2 boards. Check the token's scopes and SSO authorization. |
| `/api/health` returns 401. | `GITHUB_TOKEN` is missing, expired, or misspelled in `.env`. |
| Rate-limit banner. | The 5 000-req/hr GraphQL budget is exhausted. The banner shows when it resets; the cache will reduce calls considerably once it warms back up. |
| Empty middle/right columns after picking a project. | The default Status filter is `Hide Done`. Try the Status dropdown → `All`. |
| `EADDRINUSE :::5173`. | A previous `npm start` is still running. `pkill -f "tsx watch src/index.ts"` and try again. |

## Status / scope

This is v0.1 — single-user, local, read-only. See `docs/sprint-board-requirements.md` for the full requirements and `docs/sprint-board-implementation-plan.md` for the milestone-by-milestone plan.

Out of scope for v0.1: editing project fields, sprint analytics, multi-tenant
hosting, Slack notifications.

## License

MIT — see `LICENSE`.
