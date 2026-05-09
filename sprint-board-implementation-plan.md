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
2. Add `.gitignore`, `.env.example`, `README.md`. The `.env.example` should list `GITHUB_TOKEN`, `GITHUB_OWNER`, and `PORT`.
3. In `server/`, install `@octokit/graphql`, `@octokit/rest`, `dotenv`, `express`, `cors`. Wire up a single endpoint `GET /api/health` that calls GitHub's `viewer { login }` query and returns `{ status: "ok", login }`.
4. In `web/`, scaffold a one-page React app that calls `/api/health` on load and renders "Connected as @yourlogin." Configure Vite's dev server to proxy `/api` to the Express port.
5. Add an `npm start` script at the root that runs both servers concurrently (`concurrently` package is fine).

### Deliverable

`npm start`, open `http://localhost:5173`, see "Connected as @yourlogin."

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
   - `listProjects(owner)` → `{ number, title, url }[]`. Works for both org-owned and user-owned projects; detect which by trying `organization { projectsV2 }` first, falling back to `user { projectsV2 }`.
   - `getProjectItems(owner, projectNumber)` → fully paginated list of items.
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
   - `GET /api/projects` → list of projects.
   - `GET /api/projects/:number/items` → all resolved items.
   - `GET /api/projects/:number/team` → derived list of team members (the union of all assignees and requested reviewers across the project's items).
2. Add an in-memory cache with a 90-second TTL. Cache key is the endpoint + params. A `?refresh=1` query param bypasses the cache.
3. Handle GitHub rate limits explicitly: catch the error, return HTTP 429 with a JSON body containing `resetAt`. The frontend will surface this later.
4. Add structured logging (`pino` is fine) so you can see request timings during development.

### Deliverable

`curl http://localhost:3000/api/projects/1/items | jq '. | length'` returns the expected count.

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

## Recurring patterns when working with Claude Code on this

A few things worth doing consistently across all milestones:

- **Commit at each milestone boundary**, with a tag (`v0.1-m1`, `v0.1-m2`, …). When something breaks in M5, you want to be able to bisect.
- **Keep the requirements doc open in another tab.** When Claude Code asks "should it do X?", check the requirements first — the answer is often already there.
- **Push back on premature abstractions.** Claude Code tends to introduce service classes, dependency injection containers, and plugin architectures for problems that don't have them yet. For an app this size, plain functions and modules are the right answer.
- **Verify against the real `lightningnetwork/lnd` project at every milestone.** It's a great test fixture: public, real-world-messy, large enough to expose pagination bugs, small enough to eyeball.
- **When Claude Code suggests a library you haven't heard of, search for it before agreeing.** This is an underrated source of bugs — a deprecated or niche library can silently waste hours.
