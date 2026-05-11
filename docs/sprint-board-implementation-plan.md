# Sprint Board — Milestone Implementation Plan

**Companion to:** `sprint-board-requirements.md`
**Audience:** You, building with Claude Code
**Stack assumed:** Node.js + Express backend, React + Vite frontend, TypeScript everywhere, Tailwind for styling. Substitute freely.

---

## How this plan is organized

Seven milestones, ordered so that each one ends in something **demoable and verifiable**. The riskiest work (GitHub Projects v2 GraphQL) is front-loaded into M2 so you find out early if the data shape is what you expect. UI is deliberately delayed until you can prove the data layer works against a real project — building UI on top of a flaky data layer is the most common way these projects stall.

For each milestone:
- **Goal** — one sentence.
- **Tasks** — concrete steps in suggested order.
- **Deliverable** — what you can show at the end.
- **Verification** — the test that says "done."
- **Claude Code notes** — what to watch for when prompting.

A reasonable cadence is one milestone per evening session for M1–M3, two sessions each for M4–M5, one for M6, and M7 as time permits.

---

## Milestone 1 — Skeleton and auth (the "hello, GitHub" milestone)

**Goal.** A locally-running app that can read your GitHub PAT and successfully call the GitHub API once.

### Tasks

1. Initialize the repo with two workspaces: `server/` (Express + TS) and `web/` (Vite + React + TS). A monorepo with `npm` workspaces is fine; nothing fancier is needed.
2. Add `.gitignore`, `.env.example`, `README.md`. The `.env.example` should list `GITHUB_TOKEN`, `PORT`, and a placeholder `WORKLOAD_TEAMS=` entry (consumed in M8 — leaving it blank disables the Workload tab without breaking v0.1). No separate owner config — the token's identity is enough; the app discovers everything visible to the viewer.
3. In `server/`, install `@octokit/graphql`, `@octokit/rest`, `dotenv`, `express`, `cors`. Wire up a single endpoint `GET /api/health` that calls GitHub's `viewer { login }` query and returns `{ status: "ok", login }`.
4. In `web/`, scaffold a one-page React app that calls `/api/health` on load and renders "Connected as @yourlogin." Configure Vite's dev server to proxy `/api` to the Express port.
5. Add an `npm start` script at the root that runs both servers concurrently (`concurrently` package is fine).

### Deliverable

`npm start`, open `http://localhost:3263`, see "Connected as @yourlogin." (Vite serves the app on `3263` and proxies `/api` to the Express server on `5173`.)

### Verification

- Health endpoint works.
- Removing or invalidating the token gives a clear error in the UI, not a cryptic stack trace.
- `.env` is gitignored (`git status` should not list it).

### Claude Code notes

- Ask Claude Code to set up the workspace structure first, all in one prompt, before you start adding logic. Refactoring monorepo plumbing later is annoying.
- Be explicit that the token must only be read on the server. A natural mistake is to expose it via `import.meta.env.VITE_GITHUB_TOKEN` — call this out so it doesn't happen.

---

## Milestone 2 — GitHub data layer (the riskiest milestone)

**Goal.** A small set of typed functions that, given an org and project number, return the data the UI will need. No HTTP layer, no UI — just functions you can call from a script.

### Tasks

1. Write `server/src/github/projects.ts` with:
   - `listProjects(token)` → `{ owner, number, title, url }[]`. Aggregates Projects v2 boards across the viewer's personal account and every organization the viewer belongs to. Three paginated GraphQL calls: viewer's personal projects, viewer's organizations, then per-org projects (the per-org calls run in parallel).
   - `getProjectItems(token, owner, projectNumber)` → fully paginated list of items for one specific (owner, number).
2. Define TypeScript types for the returned shape. Each item should expose: `id`, `contentType` (`Issue` | `PullRequest`), `number`, `title`, `url`, `state`, `assignees: User[]`, `requestedReviewers: User[]` (PRs only, empty for issues), and a `fields` map keyed by field name (`Status`, `Priority`, `Size`, plus any other custom single-selects).
3. Handle pagination with cursors. Don't try to be clever; a `while (hasNextPage)` loop is correct.
4. Add a CLI script `server/scripts/dump-project.ts` that takes an org and project number on the command line and prints the resolved items as JSON. **This script is the artifact** — it's how you verify everything works before any UI exists.
5. Handle the two annoying edge cases up front: (a) draft items in a project that don't have an underlying issue/PR yet — skip them with a warning; (b) items whose content has been deleted — also skip with a warning.

### Deliverable

```
$ npx tsx server/scripts/dump-project.ts lightningnetwork 1
[ ... 200 items of resolved JSON ... ]
```

### Verification

- Run against the public `lightningnetwork/lnd` project shown in your reference screenshot. Spot-check 3–5 items against what you see in the GitHub UI: same title, same status, same priority, same assignees, same requested reviewers.
- Re-run with `time` — should complete in a few seconds for a 200-item project.

### Claude Code notes

- The single most important thing: tell Claude Code to use `@octokit/graphql`, **not** `@octokit/rest`, for project items. The REST API does not expose Projects v2 custom fields. If Claude Code tries to use `octokit.rest.projects.*`, stop it.
- Ask for the GraphQL query as a separate `.graphql` file or a tagged template literal — keeping the query out of the TypeScript logic makes it much easier to iterate on in the GitHub GraphQL Explorer (`https://docs.github.com/en/graphql/overview/explorer`).
- Before writing code, paste a sample response from the GraphQL Explorer into the chat and have Claude Code derive the types from that. Real responses will catch shape assumptions you'd otherwise get wrong.

---

## Milestone 3 — Backend API

**Goal.** Wrap the M2 functions in HTTP endpoints with caching and proper error handling.

### Tasks

1. Add three endpoints:
   - `GET /api/projects` → list of projects (`{ owner, number, title, url }[]`) aggregated across the viewer's personal account and every organization they belong to.
   - `GET /api/projects/:owner/:number/items` → all resolved items for one project. Owner is in the URL because the app can see projects from many owners.
   - `GET /api/projects/:owner/:number/team` → derived list of team members (the union of all assignees and requested reviewers across the project's items).
2. Add an in-memory cache with a 90-second TTL. Cache key is the endpoint + params. A `?refresh=1` query param bypasses the cache.
3. Handle GitHub rate limits explicitly: catch the error, return HTTP 429 with a JSON body containing `resetAt`. The frontend will surface this later.
4. Add structured logging (`pino` is fine) so you can see request timings during development.

### Deliverable

`curl http://localhost:5173/api/projects/lightningnetwork/19/items | jq '. | length'` returns the expected count.

### Verification

- All three endpoints return correct data.
- Hitting the same endpoint twice within 90 s returns instantly the second time (cache hit).
- Killing your wifi and refreshing returns a clean error, not a hang.

### Claude Code notes

- Have Claude Code write a small integration test that hits each endpoint with a mocked Octokit client. Skip this only if you're truly time-pressed; it pays off the first time you change the data layer.

---

## Milestone 4 — Frontend layout (no interactivity yet)

**Goal.** The three-column layout renders real data in the **aggregate** view (no assignee selected). Looks roughly like the reference screenshot.

### Tasks

1. Set up Tailwind. Build a top-level `<App>` with a header (project switcher placeholder, refresh placeholder, last-updated placeholder) and a three-column body.
2. Build three components:
   - `<AssigneeList>` — left column. Avatar, handle, count badge.
   - `<AssignedColumn>` — middle column. Item rows grouped by assignee in aggregate mode.
   - `<ReviewColumn>` — right column. Same but for review queue.
3. Build a reusable `<ItemRow>` with: type icon (issue circle vs PR branch icon), `#1234`, title, status pill, priority pill, size pill. Make the whole row a deep link to the item's GitHub URL.
4. Use React Query to fetch from `/api/projects/:number/items` and `/api/projects/:number/team`. Hardcode the project number for now; the switcher comes in M6.
5. Match the reference visual density. Small avatars (20–24 px), tight row spacing, subtle dividers. Resist the urge to make it look like Notion.

### Deliverable

Open the app, see the same data as your GitHub project board, organized by person.

### Verification

- All three columns populate.
- Visually compare against the reference screenshot side-by-side. Same items, same pills, similar density.
- The page renders within 1–2 seconds after the initial API call resolves.

### Claude Code notes

- Tailwind's default sizes will read as too airy. Tell Claude Code explicitly: "match GitHub's information density — small text, tight spacing, compact rows." Otherwise you'll get a lot of `p-6` and `space-y-4` everywhere.
- Pin the pill colors to specific Tailwind classes early (e.g., `P0` → `bg-red-100 text-red-800`). Otherwise every refactor will rejiggle them.

---

## Milestone 5 — Interactivity (selection and filtering)

**Goal.** The behavior described in FR-9 and FR-10 of the requirements: click an assignee, the other two columns filter to that person.

### Tasks

1. Add a `selectedAssignee` state at the `<App>` level.
2. Wire `<AssigneeList>` to set/clear it on click. Active state is a background fill plus a left-border accent.
3. Update `<AssignedColumn>` and `<ReviewColumn>` to filter when an assignee is selected, and to switch back to the grouped aggregate layout when none is selected.
4. Add the search box at the top of each column. Filter by title or `#number` substring.
5. Add the status filter (default: hide `Done`) and priority filter as small dropdowns in the header.
6. Implement the sort order from FR-13: priority ascending, status (`In review` → `In progress` → `Backlog`), number descending.
7. Keyboard nav in the left column: `↑`/`↓` to move, `Enter` to select, `Esc` to clear.

### Deliverable

The full FR-1 through FR-13 user experience works.

### Verification

- Walk through every user story in section 4 of the requirements doc. Each one should be achievable in under three clicks.
- Click `ellemouton` and verify the items match the screenshot.
- Filter to `P0` and confirm only P0 items are visible.

### Claude Code notes

- Keep filtering on the client. A 200-item project is small enough that re-rendering on every keystroke is fine, and round-tripping to the server makes the UI feel sluggish.
- Don't let Claude Code push you toward a state library (Zustand, Redux) at this scale. Plain `useState` plus React Query is enough.

---

## Milestone 6 — Polish (the milestone where it stops being a prototype)

**Goal.** The app is good enough to actually run a sprint review with.

### Tasks

1. **Project switcher.** Real dropdown in the header backed by `/api/projects`.
2. **Refresh button.** Calls each endpoint with `?refresh=1`. Shows a spinner. Updates the "Last updated HH:MM" indicator.
3. **Loading states.** Skeleton rows in each column on first load. Spinner on refresh, not skeletons (refresh shouldn't blank the screen).
4. **Error states.** Rate limit banner with the reset time. Network error banner with a retry button. Empty state per column ("No items assigned" / "Nothing in review queue").
5. **Accessibility pass.** All interactive elements reachable by keyboard. ARIA labels on icon-only buttons. Pills have text labels, not just color.
6. **README.** Setup instructions including the PAT generation steps from section 7 of the requirements doc. A screenshot is worth including.

### Deliverable

You hand the repo to a teammate, they follow the README, and they're running it in five minutes.

### Verification

- Test the cold-start flow with a fresh checkout in a different directory.
- Try every error path you can think of: bad token, no internet, no projects in the org, project with zero items, project with 500 items.

### Claude Code notes

- Resist scope creep here. It's tempting to keep adding features. The goal of M6 is to make M1–M5 robust, not to add new ones. Save ideas for M7.

---

## Milestone 7 — Stretch goals (optional)

Pick whichever of these would actually change how you run sprints. None are required.

- **Auto-refresh** every 5 minutes with a visible countdown.
- **"Hide my approved reviews" toggle** — by default, hide PRs from the review column where the selected user has already left an approving review. Open question 2 in the requirements doc; choose now whether the default is "hide" or "show."
- **Multi-project view** — show two projects (e.g., v0.22 and v0.23) side by side, useful during a release transition.
- **Per-person aging** — show how many days each item has been in its current status. Surfaces the items that are quietly stuck.
- **Slack export** — a "Copy stand-up summary" button that puts a markdown summary of one assignee's items on the clipboard, formatted for pasting into Slack.
- **OAuth Device Flow** — replace the PAT setup with a "Log in with GitHub" flow (still no hosted callback needed). Section 7 of the requirements doc explains why this is a v2 feature, not v1.

---

# v0.2 — Workload distribution dashboard

The next three milestones implement the v0.2 Workload tab specified in section 11 of the requirements doc. They follow the same data → API → UI cadence as v0.1's M2 → M3 → M4 — front-loading the riskiest part (the new GraphQL search shape and team-resolution edge cases) into M8 before any HTTP or UI is built. M9 introduces client-side routing into the v0.1 app, which is itself a non-trivial refactor and deserves its own milestone.

---

## Milestone 8 — v0.2 data layer

**Goal.** Pure functions that, given `WORKLOAD_TEAMS`, return a roster and a per-developer per-repo count breakdown. No HTTP, no UI — just code you can call from a CLI script. Mirrors M2's structure and intent.

### Tasks

1. Add a config module that parses `WORKLOAD_TEAMS` (comma-separated `org/team-slug`) and `WORKLOAD_ORGS` (comma-separated bare org logins). Surface clear errors for malformed entries; empty/missing variables are valid (the workload tab becomes disabled only when *both* are blank). `WORKLOAD_ORGS` is search-scope only — its orgs are unioned with the team-derived orgs but do not contribute to the roster.
2. Write `resolveRoster(teams)` — calls `GET /orgs/{org}/teams/{slug}/members` for each entry (in parallel) and returns `{ orgs, roster, warnings }`. Deduplicate orgs and logins. Per-team failures become warnings, not exceptions.
3. Write `getDeveloperWorkload(login, orgs)` — runs the two GraphQL `search` queries per org (`is:open assignee:<login> org:<org>`, `is:open review-requested:<login> org:<org>`) in parallel. Aggregate results to `{ assigned: [{repo, count}], reviewing: [{repo, count}] }`. Fetch only `repository.nameWithOwner` from each search hit.
4. Handle the GraphQL search 1000-result cap defensively: log a warning if `issueCount > 1000` for any query. Per-repo fallback iteration can wait until M10, unless you actually hit the cap during verification.
5. CLI script `server/scripts/dump-workload.ts <login>` that prints the aggregated counts as JSON. **This script is the artifact** — same pattern as M2's `dump-project.ts`.

### Deliverable

```
$ npx tsx server/scripts/dump-workload.ts saubyk
{
  "assigned":  [{ "repo": "lightningnetwork/lnd", "count": 6 }, ...],
  "reviewing": [{ "repo": "lightningnetwork/lnd", "count": 5 }, ...]
}
```

### Verification

- Run against a known developer in your team. Per-repo counts match what the equivalent `is:open assignee:<login> org:<org>` and `is:open review-requested:<login> org:<org>` queries return in GitHub's search UI.
- Misspell a team in `WORKLOAD_TEAMS`. The warning shows up in CLI output; the script doesn't crash.
- Run with both `WORKLOAD_TEAMS` and `WORKLOAD_ORGS` blank. The script exits cleanly with a "no teams or orgs configured" message.
- Run with only `WORKLOAD_ORGS` set (no `WORKLOAD_TEAMS`). The roster is empty but the configured orgs are still searched for the given login.

### Claude Code notes

- Use `@octokit/graphql` for the search query and `@octokit/rest` for team membership (`octokit.rest.teams.listMembersInOrg`). Team membership is not available through Projects v2 GraphQL.
- Resist the urge to fetch full item details. The chart only needs `repository.nameWithOwner` — anything more is wasted bandwidth.
- Don't introduce a config-validation library (zod, ajv, etc.). A small parse function with explicit error messages is enough at this scale.

---

## Milestone 9 — v0.2 backend API + top-level tab navigation

**Goal.** Wrap M8's functions in HTTP endpoints, and introduce React Router so the app has a real "Sprint Board" / "Workload" tab switcher. The Workload tab is just a placeholder at the end of this milestone — UI lands in M10.

### Tasks

1. Resolve the roster once at server startup using M8's `resolveRoster`. Cache the result in memory. Documented refresh path: restart the server.
2. Add `GET /api/workload/roster` (resolved roster + configured orgs + warnings) and `GET /api/workload/:login` (aggregated counts). Same 90s cache pattern as M3; `?refresh=1` bypasses.
3. Install `react-router-dom`. Add two routes: `/` (existing Sprint Board) and `/workload` (placeholder component).
4. Add header-level tabs for "Sprint Board" and "Workload". Active tab gets a clear visual treatment (underline or fill).
5. Workload route renders only an empty placeholder ("Workload — UI in M10") at this stage. No data fetching here.

### Deliverable

- `curl http://localhost:5173/api/workload/roster` returns the configured roster.
- `curl http://localhost:5173/api/workload/<login>` returns aggregated counts.
- Click between the two tabs in the UI without regression to v0.1 flows.

### Verification

- All v0.1 functionality still works after the routing refactor — assignee selection, filters, refresh, project switcher.
- `/workload` is a real route: deep links work, browser back/forward work.
- Cache hit on a second roster fetch within 90s.
- A bad token still surfaces the same clean error from M1, not a router-level crash.

### Claude Code notes

- React Router v6+. Use `<Routes>` / `<Route>` and `<Outlet />` for the shared header. Don't drag in v5 patterns from training data.
- Don't introduce Redux or Zustand for active-tab state — the route is the state.
- Wrap the existing v0.1 layout in a minimal `<AppShell>` that adds the header tabs above the existing content. Don't restructure the v0.1 components themselves.

---

## Milestone 10 — v0.2 Workload UI

**Goal.** The visualization-first dashboard. Pick a developer from the left rail, see two pie charts of their open work distributed across repos.

### Tasks

1. Install Recharts.
2. Lift Sprint Board's `selectedLogin` out of `SprintBoardRoute` into a shared location the Workload route can read — `AppShell` state exposed via Outlet context is the natural fit. Sprint Board continues to read/write it; this is purely a state-lift refactor.
3. Build `<DeveloperPicker>` — left rail, alphabetical, avatar + handle. **No count badges** (rationale captured in FR-W5 of the requirements doc). On Workload-route mount, initialize the picker's selection from the lifted Sprint Board state. If the carried-over login is in the roster, pre-select it; if it isn't, leave selection empty and render the FR-W4 hint ("`<login>` isn't in the configured workload roster"). Workload's own picker changes stay local — they do not write back to the lifted Sprint Board state.
4. Build `<WorkloadCharts>` — two side-by-side pies (Assigned, Reviewing). Each shows the total count in the title and a legend mapping slice colors to `repo` / absolute count.
5. Counts/percentages toggle on the chart pair. Counts is the default. Pin colors via a stable `repo → color` map so a slice doesn't change color when toggling modes or when the underlying data shifts.
6. Empty state ("Pick a developer to see their workload distribution") when no developer is selected.
7. Warning banner shown when `/api/workload/roster` returns warnings (unresolvable teams).
8. Loading and error states: skeleton on first chart load, error banner on rate-limit or network failure (reuse v0.1's banner where possible).
9. Update the README's PAT-permissions section to add `Members: Read` for every org in `WORKLOAD_TEAMS`.

### Deliverable

Pick a developer in the left rail → two pie charts render within a second on cache hit. Counts/percentages toggle works. Misspelled team in `.env` → warning banner visible; the rest of the tab still works.

### Verification

- Chart counts match the equivalent GitHub search UI queries for several developers.
- On first page load of `/workload`, only `/api/workload/roster` fires. No per-developer fetches until a click. Confirm in the network tab.
- Pick a developer with zero open items in some category — the empty pie renders gracefully (e.g., a placeholder "No open assigned items").
- Recharts legend doesn't truncate repo names at the default viewport width.

### Claude Code notes

- Recharts colors: use the `<Cell>` API and a stable `repo → color` map computed once. Don't try to recolor pies via Tailwind class injection — it won't take.
- Pie label collisions are real with many small slices. If a chart has more than ~6 repos, prefer legend-only labeling and skip on-slice text.
- Don't generalize v0.1's column components into shared abstractions for this layout. The shapes diverge enough (item rows vs aggregated charts) that adapter props would obscure both — a fresh `<WorkloadCharts>` is cleaner.

---

## Milestone 11 — Workload drill-down (slice → item list)

**Goal.** Make the donut charts actionable: clicking a slice (or its legend row) opens a list of the underlying items below the chart grid (FR-W11).

### Tasks

1. Expand the workload data shape end-to-end. The search GraphQL keeps the same `type: ISSUE`, `first: 100`, paginated structure but now selects `__typename, number, title, url, repository.nameWithOwner` for each Issue/PullRequest node. The data layer returns flat `WorkloadItem[]` for `assigned` and `reviewing` instead of pre-aggregated `RepoCount[]`. Per-repo counts become a UI-side derivation.
2. Update `WorkloadResponse` in `server/src/workload/service.ts` and `web/src/types.ts` to carry items. The 90s API cache key and the rate-limit / cap warnings are unchanged.
3. In `<WorkloadCharts>`, hold a single `selection: { kind: "assigned" | "reviewing"; repo: string } | null` state. Wire `onClick` on both the `<Pie>` and each legend `<li>` to toggle that selection. Selection is single-across-both-charts: picking a slice in one clears any selection in the other.
4. Visually mark the selected slice (raised stroke, full opacity) and dim non-selected slices when something is selected. Mark the matching legend row with a subtle background + `aria-pressed`.
5. Render a drill-down panel below the chart grid when a selection exists. Header: color swatch, `<repo>` (mono), kind label, count, Close button. Rows: type icon (PR vs Issue), `<short-repo>#<number>`, title, `<a target="_blank" rel="noopener noreferrer">` to the GitHub URL. The panel is capped at ~45% of the chart area and scrolls internally so the charts stay visible.
6. Reset the selection when the developer changes (login dependency). Don't persist it in the URL.

### Verification

- Click a slice → list opens with the right items for that `(kind, repo)`.
- Click a legend row → same effect as clicking the slice.
- Click the same slice again, or the Close button → list closes.
- Click a slice in the other chart while one is open → selection swaps; the first chart goes back to its "unselected" appearance.
- Switch developer in the left rail → selection clears.
- A developer with > 1000 open items in one query still surfaces the existing cap warning; the list shows what was fetched.

### Claude Code notes

- The search query is the same network shape; only the node selection grew. Don't add a parallel "fetch items by repo" query — the data is already there.
- Resist promoting `DrillDownPanel` to a shared component. It's specific to this layout and only used here.
- Slice clicks fire on the `<Pie>`, not on individual `<Cell>` elements (Recharts wires it that way). The handler receives the payload — pull `repo` off `payload.payload`.

---

## Recurring patterns when working with Claude Code on this

A few things worth doing consistently across all milestones:

- **Commit at each milestone boundary**, with a tag (`v0.1-m1`, `v0.1-m2`, …). When something breaks in M5, you want to be able to bisect.
- **Keep the requirements doc open in another tab.** When Claude Code asks "should it do X?", check the requirements first — the answer is often already there.
- **Push back on premature abstractions.** Claude Code tends to introduce service classes, dependency injection containers, and plugin architectures for problems that don't have them yet. For an app this size, plain functions and modules are the right answer.
- **Verify against the real `lightningnetwork/lnd` project at every milestone.** It's a great test fixture: public, real-world-messy, large enough to expose pagination bugs, small enough to eyeball.
- **When Claude Code suggests a library you haven't heard of, search for it before agreeing.** This is an underrated source of bugs — a deprecated or niche library can silently waste hours.
