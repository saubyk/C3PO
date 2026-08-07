# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run everything from the repo root (npm workspaces: `server`, `web`).

```bash
npm start                        # server (:5173) + Vite dev (:3263) together
npm run start:debug              # same, with LOG_LEVEL=debug (verbose pino + vite logs)
npm run typecheck                # both workspaces
npm run build                    # both workspaces
npm test --workspace=server      # vitest, the only test suite in the repo
npm test --workspace=server -- -t "bypasses the cache"   # single test by name
npm test --workspace=server -- src/__tests__/app.test.ts # single file
```

Debug the data layer without the UI:

```bash
npx tsx server/scripts/dump-project.ts <owner> <number>   # project items as JSON
npx tsx server/scripts/dump-workload.ts <login>           # per-repo workload counts
```

`server` typechecks via a separate `tsconfig.typecheck.json` (noEmit, and it
widens `include` to cover `scripts/**` which the build config excludes) — so
`npm run typecheck` catches errors in the dump scripts that `npm run build`
won't.

There is no linter configured. Typecheck + the server suite are the checks.

The `/verify` skill (`.claude/skills/verify/SKILL.md`) documents how to launch
and drive the app headlessly with Playwright, including hard-won gotchas — read
it before doing any UI verification rather than rediscovering them.

## Architecture

Local, single-user, **read-only** tool. It reorganizes a GitHub Projects v2
board around *people* rather than items.

```
browser :3263  ──/api proxy──►  Express :5173  ──GraphQL──►  github.com
React + Tailwind                 Octokit                     (read-only)
```

The Vite proxy is load-bearing: `GITHUB_TOKEN` lives only in the server
process, and the browser has no notion of it. Never add a code path that ships
the token or calls github.com from `web/`.

### Server layers

1. **`server/src/app.ts`** — route definitions + centralized error mapping.
   Every route is `requireToken()` → validate params → `getOrFetch(cache, …)`.
   `createApp({ cache, logger })` takes injectable deps, which is what makes
   the tests able to mock the data layer entirely.
2. **Data layer** — `github/projects.ts` (Projects v2 GraphQL, cursor
   pagination on every connection) and `workload/` (`config` → `roster` →
   `developer`, composed by `service.ts`).

Two cache-sharing decisions that are easy to break:

- `/team` reuses the **`items:{owner}:{number}`** cache key, so hitting both
  endpoints costs one upstream fetch. Changing either route's key silently
  doubles GitHub traffic; a test asserts this.
- `/api/workload/:login` fetches the roster first, because the roster's
  resolved org list is the search scope for the per-developer queries. One
  `?refresh=1` re-resolves both.

Cache is in-memory, 90 s TTL, `?refresh=1` bypasses. Restarting the server
clears it.

Error mapping lives in one place (the final `app.use` handler) and is
exhaustively tested: rate limit → 429 with `resetAt`, `ConfigError` → 500,
`BadRequestError` → 400, `NotFoundError` / upstream GraphQL `NOT_FOUND` → 404,
401 passthrough, everything else upstream → 502. Throw the right error class
from the data layer rather than crafting responses in a route.

Partial failure is deliberately non-fatal: `listProjects` uses
`Promise.allSettled` per org and warns on unreadable ones; workload searches
collect per-query `warnings[]` that the UI renders in a banner. Keep that
shape — don't let one unreadable org fail the whole request.

### GitHub semantics encoded in the code

These are non-obvious API behaviors that were fixed as bugs; preserve them:

- **Reviewers = requested ∪ already-submitted.** GitHub drops a user from
  `reviewRequests` the moment they submit a review, so `collectReviewers`
  unions `reviewRequests` with `latestReviews` (`github/projects.ts`). The
  Workload tab does the equivalent by unioning `review-requested:` with
  `reviewed-by:` searches per org (`workload/developer.ts`).
- **Search caps at 1000 results per query**, pagination or not — exceeding it
  sets a `capped` warning rather than silently truncating.
- **"Hide Done" matches decorated statuses** via `/\bdone\b/i`, so boards using
  "✅ Done" or "Done (shipped)" still filter correctly (`grouping.ts`).
- `fieldValues[].updatedAt` is when *that field* last changed on *that item* —
  it drives the staleness badges, and is not the item's `updatedAt`.

### Web

- **All fetching goes through `web/src/api.ts`** — thin react-query hooks over
  a `fetchJson` that throws `ApiError` carrying `status` + `resetAt`. Routes
  branch on `ApiError.status === 429` to pick the rate-limit banner. Queries
  are configured with `retry: false` and no refetch-on-focus; refresh is
  explicit (fetch `?refresh=1` to bust the *server* cache, then
  `queryClient.invalidateQueries` to bust react-query's).
- **State ownership**: `App.tsx` is a layout route holding only cross-route
  state, passed down via `useOutletContext` (`AppOutletContext`).
  `boardSelectedLogin` is owned by the Sprint Board; the Workload route seeds
  its picker from it **once, one-way** — it must never write back. Each route
  feeds the footer through `setStatusMeta`.
- **`deriveTeam` exists twice** — `server/src/app.ts` (for `/team`) and
  `web/src/components/grouping.ts`. The client version is the one the Sprint
  Board actually uses, because counts must reflect the *client-side* Status /
  Priority filters. `useTeam` in `api.ts` is currently unused; `/team` is a
  standalone API surface.
- **Types are mirrored, not shared**: `web/src/types.ts` duplicates the server
  types by hand (no cross-workspace import). Change a server response shape and
  you must hand-update the mirror.
- `grouping.ts` holds all board sorting, filtering, and grouping as pure
  functions — the natural place for board-logic changes and for tests, if a web
  suite is ever added.

### Theming

Tailwind v4 with tokens declared in `web/src/index.css`: dark values in
`@theme`, light overrides in an un-layered `:root[data-theme="light"]` block
(un-layered so it wins over `@theme`). `web/index.html` has an inline script
that applies the stored choice before first paint; `theme.ts` toggles the
attribute at runtime. Dark is the default and carries no attribute.

Consequence: **never hardcode a hex in a component.** Use the token utilities
(`bg-panel`, `text-faint`, `border-line2`) or `var(--color-*)`, or the color
breaks in one of the two themes. `withAlpha()` in `components/color.ts` exists
because `color-mix` works on `var()` references where hex-string parsing
doesn't.

The one intentional exception is `REPO_COLORS` in `WorkloadCharts.tsx` — a
fixed repo→color map shared by both pie charts so a repo is the same color in
each, with a deterministic name-hashed pastel fallback for unmapped repos.

## Configuration

Three settings, resolved **per field** by `server/src/config/load.ts` from
three layers, highest precedence first: the real process environment → a JSON
config file (`$C3PO_CONFIG`, else `$XDG_CONFIG_HOME/c3po/config.json`, else
`~/.config/c3po/config.json`) → `<repo>/.env`.

- `GITHUB_TOKEN` / `githubToken` — required. Scopes: `read:project`,
  `read:org`, plus `repo` for private repos. Never `write:*`/`admin:*`.
  Can instead be a *pointer* to a file holding only the secret
  (`GITHUB_TOKEN_FILE` / `githubTokenFile`), which is the recommended setup:
  settings file ordinary, token file 0600. Within a layer, inline beats
  pointer (with a warning); a pointer in the config file resolves relative to
  that file's own directory.
- `WORKLOAD_TEAMS` / `workloadTeams` — `org/team-slug` list; resolves to the
  Workload roster. Blank leaves the Workload tab an empty placeholder.
- `WORKLOAD_ORGS` / `workloadOrgs` — widens the workload *search scope* only;
  it does not add anyone to the roster.

Rules the layering depends on, easy to break:

- **`createApp()` never touches the filesystem.** It defaults to
  `configFromEnv()` (pure `process.env`) and takes a resolved `config` as an
  injectable dep alongside `cache`/`logger` — that's what lets the tests run
  without a config file existing anywhere. All file I/O lives in `loadConfig()`,
  called by the three boot entry points: `index.ts` and both dump scripts.
- **`loadConfig()` must read `process.env` before .env is applied**, or `.env`
  becomes indistinguishable from the real environment and silently jumps to
  the top of the precedence order. It snapshots first, then hydrates
  `process.env` from `.env` at the end (non-overriding) so `PORT` /
  `LOG_LEVEL` keep working.
- Blank counts as **unset** at every layer, so the `WORKLOAD_TEAMS=`
  placeholder shipped in `.env.example` doesn't shadow a real value below it.
- List settings are normalised to the comma-separated string form so
  `workload/config.ts` stays the single place that validates them.
- Config-file problems (missing explicit `C3PO_CONFIG`, bad JSON, wrong types,
  an unfollowable token pointer, an empty or multi-line token file) throw
  `ConfigFileError` and **exit 1 at boot**. A token pointer that can't be
  followed must never fall through to a lower layer — that would silently
  authenticate you as whoever `.env`'s token belongs to. A merely *absent*
  token stays a per-request 500, as it always was.
- `configFromEnv()` deliberately does **not** follow `GITHUB_TOKEN_FILE`:
  it's the zero-I/O path. Following pointers is `loadConfig()`'s job, and
  every boot path goes through that.

`docs/sprint-board-requirements.md` carries the FR-numbers referenced in code
comments (e.g. FR-W4, FR-W10); check there when a comment cites one.
