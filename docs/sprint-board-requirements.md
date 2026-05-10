# Sprint Tracking Board — Requirements Document

**Project name (working):** SprintLens
**Version:** 0.1 (Draft)
**Owner:** Project Management
**Status:** Draft for engineering review

---

## 1. Overview

A lightweight, locally-served web application that mirrors the data behind a GitHub Project (e.g., the `lnd v0.22` board shown in the reference screenshot) but reorganizes it around the question Project Managers and Product Managers ask most often during a sprint:

> *"For each person on the team, what are they building, and what are they reviewing?"*

GitHub Projects answers "what is the state of every item." This tool answers "what is the state of every person." The two views are complementary; this tool is intended to live alongside GitHub Projects, not replace it.

The app pulls live data from one or more GitHub Projects (and the underlying issues/PRs) and presents it in a three-column, person-centric layout.

---

## 2. Goals and non-goals

### Goals

- Give a PM a single screen that surfaces, per assignee, both the **work-in-flight** (issues + PRs assigned to them) and the **review load** (PRs where they are a requested reviewer).
- Run locally with near-zero setup — a PM should be able to clone, configure a token, and run.
- Stay read-only against GitHub in v1; this is a *viewing* tool, not an editing tool.
- Support multiple projects (e.g., `lnd v0.22`, `lnd v0.23`) selectable at runtime.

### Non-goals (v1)

- Editing issue state, assignees, labels, or project fields from the UI.
- Replacing GitHub's native Project board, Backlog, or Roadmap views.
- Multi-tenant hosting, SSO, or team-management features.
- Sprint analytics/burndown charts (possible v2).
- Mobile-optimized layout (desktop-only is acceptable for v1).

---

## 3. Target users and personas

**Primary — Engineering Project Manager.** Runs weekly sprint syncs and 1:1s. Needs to quickly see who is overloaded, who is blocked on reviews, and which P0 items have no movement.

**Secondary — Product Manager.** Less interested in review queues, more interested in scope and progress on epics. Will use the same UI but typically filter to higher-priority items.

**Tertiary — Engineering Lead / Tech Lead.** Uses the tool ad-hoc to check review balance across the team before assigning a new PR.

---

## 4. User stories

1. As a PM, I want to **see all team members on the left** so I can scan who is on the sprint without scrolling.
2. As a PM, I want to **click a team member and see only their work** in the middle and right columns so I can prepare for a 1:1 in seconds.
3. As a PM, I want to **see at a glance which PRs are blocked on review** so I can nudge reviewers in stand-up.
4. As a tech lead, I want to **see review load per person** so I don't pile another PR on someone who already has four open reviews.
5. As a PM, I want to **switch between projects** (e.g., different release milestones) without restarting the app.
6. As a PM, I want **status, priority, and size to be visible** on each item so I can spot mismatches (e.g., a P0 sitting in Backlog).
7. As any user, I want the data to be **fresh** — manual refresh is acceptable, but stale data should be obvious.

---

## 5. Functional requirements

### 5.1 Data sources

- **FR-1.** The app uses the authenticated user's identity (derived from the PAT) to discover every Projects v2 board they can read — across their personal account and every organization they belong to. There is no separate "configured owner"; one token is enough.
- **FR-2.** The app supports selecting one GitHub Project (Projects v2) at a time as the active view. The list of available projects is fetched on startup.
- **FR-3.** For the active project, the app fetches every project item and resolves it to its underlying issue or pull request, including: title, number, type (issue/PR), state (open/closed/merged), assignees, requested reviewers (PRs only), and the project-level fields **Status**, **Priority**, and **Size** (and any other custom single-select fields, displayed generically).
- **FR-4.** The app fetches the list of "team members" as the **union of all assignees and requested reviewers** appearing in the active project. (No separate team configuration is needed for v1; teams are inferred from project participation.)
- **FR-5.** The app excludes items where `status = Done` by default, mirroring the `-status:Done` filter visible in the reference screenshot. This filter is toggleable.

### 5.2 Layout — three-column person-centric view

```
┌──────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│   ASSIGNEES      │   ASSIGNED TO (issues + PRs)    │   REVIEWING (PRs)               │
│   (left)         │   (middle)                      │   (right)                       │
├──────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ ▸ ellemouton  7  │  #10657 graph/db: v2 model …    │  #10777 chanstate: introduce …  │
│ ▸ saubyk      5  │  #10676 graph/db: private …     │  #1223  db: add SQL tx detail … │
│ ▸ bitromortac 4  │                                 │                                 │
│ ▸ ziggie1984  3  │                                 │                                 │
│   …              │                                 │                                 │
└──────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

- **FR-6. Left column — Assignees.** A vertical list of every team member (avatar, handle, item count). Sortable by name or by total open item count. The numeric badge next to each name should match the total of (assigned + reviewing) so a PM can spot overload immediately.
- **FR-7. Middle column — Assigned items.** Cards (or rows) for every issue and PR assigned to the currently selected user, showing: type icon (issue vs PR), number, title, status pill, priority pill, size pill, and a deep link out to the GitHub item.
- **FR-8. Right column — Review queue.** Cards/rows for every PR where the selected user is a *requested reviewer* (and has not yet approved/changes-requested-and-resolved). Same fields as middle column, plus the PR author's avatar.
- **FR-9. Default state (no selection).** When no assignee is selected, middle and right columns show the **aggregate** view across the whole team, grouped by assignee. This matches the `lnd v0.22` reference behavior.
- **FR-10. Selection behavior.** Clicking an assignee in the left column filters the middle and right columns to only that person. Clicking the same assignee again, or clicking a "Clear" control, returns to the aggregate view. Only one assignee can be selected at a time in v1.

### 5.3 Filtering, sorting, refresh

- **FR-11.** A search box at the top of each column filters items by title or number.
- **FR-12.** A status filter (default: hide `Done`) and a priority filter (`P0`, `P1`, `P2`, …) apply to both middle and right columns.
- **FR-13.** Items in the middle column are sorted by priority ascending (P0 first), then by status (`In review` → `In progress` → `Backlog`), then by issue number descending.
- **FR-14.** A manual **Refresh** button re-fetches all data. The header shows "Last updated HH:MM" so stale state is visible. Auto-refresh on an interval (e.g., 5 minutes) is a stretch goal.

### 5.4 Project switching

- **FR-15.** A dropdown in the header lists every Projects v2 board the authenticated user can read across their personal account and every organization they belong to, grouped by owner. The most recently selected project is remembered locally (browser `localStorage`) and preselected on next launch. Switching projects re-runs the full fetch.

---

## 6. UI / UX requirements

- Density should match a GitHub-style information-dense layout (compact rows, small avatars, readable but small type). The reference screenshot is the visual target.
- Color-coded status pills (`In progress`, `In review`, `Backlog`) and priority pills (`P0` red, `P1` orange, `P2` yellow, …) consistent with GitHub's color conventions.
- The selected assignee in the left column has a clear active state (background fill + left-border accent).
- Empty states ("No items assigned", "Nothing in review queue") are explicit, not blank.
- The whole UI fits on a 1280×800 viewport without horizontal scrolling.

---

## 7. Authentication — recommended approach

The simplest, most reliable path for a locally-served PM tool is a **GitHub fine-grained Personal Access Token (PAT)** stored in a local `.env` file.

### Why this is the right default

- Zero OAuth infrastructure to maintain. No callback URL, no client secret rotation, no app registration approval flow.
- Works identically for the open-source LND org and any private fork without re-configuring a GitHub App.
- The user (a PM) already has a GitHub account and can generate a token in under a minute.
- Tokens are scoped — the user grants only the permissions the app needs.

### Required token permissions (fine-grained PAT)

For each organization whose projects the user wants to browse (and the user's personal account, if relevant):

- **Repository permissions:** `Issues: Read`, `Pull requests: Read`, `Metadata: Read` (auto-included).
- **Organization permissions:** `Projects: Read`, plus `Members: Read` so the app can enumerate orgs the user belongs to.
- **Account permissions:** `Projects: Read` if the user has personal Projects v2 boards.

### Setup flow

1. User runs `npm install` (or equivalent) and copies `.env.example` to `.env`.
2. User visits `https://github.com/settings/personal-access-tokens/new`, generates a fine-grained PAT with the scopes above, and pastes it into `GITHUB_TOKEN=` in `.env`.
3. User runs `npm start`. The app reads the token from the environment and never sends it to any third party.

### Why not OAuth or a GitHub App in v1

- **OAuth web flow** requires a hosted callback URL or a localhost redirect dance that breaks for users behind corporate proxies — too much friction for an internal tool.
- **GitHub App** is the right choice if this ever becomes a hosted multi-tenant service, but is over-engineered for a locally-run PM utility. It also requires org-admin approval to install, which a PM may not have.
- **OAuth Device Flow** is a reasonable upgrade path in v2 — it gives a polished "log in with GitHub" experience without requiring a hosted callback. Recommend tracking it but not blocking v1.

### Security notes

- The `.env` file must be gitignored. Ship a `.env.example` with empty values.
- The token is only ever read server-side (the local Node/Python process). It is never sent to the browser. The browser talks to the local server, the local server talks to GitHub.
- A "Clear token / log out" command should simply mean deleting the `.env` file; the docs should say this explicitly.

---

## 8. Technical recommendations (non-binding)

These are starting suggestions; the implementing team should feel free to substitute equivalents.

- **Backend:** Node.js + Express (or Fastify). The Express API listens on `http://localhost:5173`; the Vite dev server runs on `http://localhost:3263` and proxies `/api/*` to the Express port. The browser only ever talks to `3263`.
- **GitHub client:** `@octokit/graphql` for Projects v2 (GraphQL is the only supported API for v2 fields) and `@octokit/rest` for any supplemental REST calls.
- **Frontend:** React + Vite. Lightweight state via React Query (handles caching, refetch, and stale indicators out of the box).
- **Styling:** Tailwind CSS for speed; aim for visual parity with the reference screenshot.
- **Caching:** In-memory cache in the Node process with a short TTL (60–120 s) to avoid hammering the GitHub API on every column re-render. Manual refresh bypasses cache.

### Key GraphQL query shape

The project-items query is the heaviest call. Roughly:

```
query ($org: String!, $projectNumber: Int!, $cursor: String) {
  organization(login: $org) {
    projectV2(number: $projectNumber) {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          fieldValues(first: 20) { nodes { … Status, Priority, Size … } }
          content {
            ... on Issue       { number title assignees(first: 10) { nodes { login avatarUrl } } }
            ... on PullRequest { number title assignees(first: 10) { nodes { login avatarUrl } }
                                 reviewRequests(first: 10) { nodes { requestedReviewer { … on User { login avatarUrl } } } } }
          }
        }
      }
    }
  }
}
```

Pagination is required — projects routinely exceed 100 items.

---

## 9. Non-functional requirements

- **Performance.** Initial load of a 200-item project should render in under 5 s on a typical laptop with a good connection. Switching assignees is purely client-side filtering and must feel instant (<100 ms).
- **Reliability.** Handle GitHub API rate limits gracefully — show a clear banner when throttled, with the reset time.
- **Portability.** Runs on macOS, Linux, and Windows (WSL acceptable). No native dependencies.
- **Accessibility.** Keyboard navigation in the left column (arrow keys to move, Enter to select). Color is never the only signal — pills include text labels.
- **Privacy.** No telemetry, no third-party analytics. The app makes outbound requests only to `api.github.com`.

---

## 10. Acceptance criteria (v1)

The v1 release is complete when a PM can, against the real `lightningnetwork/lnd v0.22` project:

1. Start the app locally with a single `npm start` after a one-time PAT setup.
2. See all team members in the left column with accurate counts.
3. Click `ellemouton` and see exactly the 7 items shown for her in the reference screenshot, split correctly between assigned (middle) and reviewing (right).
4. Filter by `Priority: P0` and see only P0 items across both columns.
5. Switch to a different project from the dropdown and have the view repopulate within 5 s.
6. Refresh after a teammate self-assigns a new issue and see it appear without restarting the app.

---

## 11. Planned for v0.2 — Workload distribution dashboard

A second top-level view, served from `/workload`, that complements v0.1's project-board-scoped view. Where v0.1 answers "what specifically is each person doing on this sprint board," v0.2 answers "*where* is each person's attention going across the team's repos." The output is a visualization, not an item list.

### 11.1 Motivation

A PM tracking work across multiple repos (e.g., `lnd`, `lightning-terminal`, `taproot-assets`) wants to spot when a teammate is spread too thin, or when their review load is concentrated in repos far from where they're shipping. v0.1's per-project-board view cannot answer this — many issues and PRs that consume a teammate's time are not on any one project board.

### 11.2 Comparison with v0.1

| Dimension         | v0.1 Sprint Board                            | v0.2 Workload                                            |
|-------------------|----------------------------------------------|----------------------------------------------------------|
| Scope             | One Projects v2 board                        | All repos in the orgs implied by configured GitHub teams |
| Roster source     | Inferred from project assignees + reviewers  | GitHub team membership defined in `.env`                 |
| Default view      | Aggregate across team                        | Empty until a developer is picked                        |
| Output            | Three columns of item rows                   | Two pie charts of counts grouped by repo                 |
| Item-level fields | Status, Priority, Size pills                 | None — counts only                                       |

### 11.3 User stories

1. As a PM, I want to **pick a teammate and see how their open work is distributed across our repos**, so I can tell if they're spread too thin.
2. As a tech lead, I want to **compare a teammate's review-load distribution to their assigned-work distribution**, so I can spot when they're being pulled into reviews far from where they're shipping.
3. As a PM prepping for a 1:1, after picking a teammate on the Sprint Board, I want to **switch to the Workload tab and see that same teammate's distribution without re-selecting them.**

### 11.4 Functional requirements

- **FR-W1.** A new top-level "Workload" tab/route alongside "Sprint Board".
- **FR-W2.** Configuration is read from `.env` at startup. `WORKLOAD_TEAMS` is a comma-separated list of `org/team-slug` entries (e.g., `WORKLOAD_TEAMS=lightningnetwork/lnd-maintainers,lightningnetwork/lit-team`).
- **FR-W3.** On startup, each entry is resolved to its GitHub team members. The roster of monitored developers is the union of those memberships; the set of orgs to search is the set of orgs implied by those entries (deduplicated). Resolution failures are logged and shown as a warning banner; the tab continues with the teams that did resolve.
- **FR-W4.** Default state: the page shows the developer picker on the left and an empty state on the right ("Pick a developer to see their workload distribution"). No per-developer data is fetched until a developer is selected. **Carry-over from Sprint Board:** when the user navigates to the Workload tab while a developer is selected on the Sprint Board, that login becomes the initial Workload selection (provided they are a member of the configured roster). If the carried-over login is not in the roster, the picker shows the default empty state with an additional hint: `<login> isn't in the configured workload roster.`
- **FR-W5.** The left-rail picker lists every login from the resolved roster, sorted alphabetically. Avatar + handle only — **no count badge**. Showing per-developer counts on the picker would require fetching every developer's workload at page load (N parallel search queries before the user has clicked anything); the convenience is not worth that cost.
- **FR-W6.** On developer selection, the right side renders **two pie charts side-by-side**:
  - **Assigned (N)** — open issues + PRs assigned to this developer, sliced by repo across all configured orgs.
  - **Reviewing (N)** — open PRs where this developer is a requested reviewer, sliced by repo.
- **FR-W7.** Each chart shows a total count in the title and a legend mapping slice colors to `repo` / absolute count.
- **FR-W8.** A small toggle switches slice labels between absolute counts and percentages. Counts is the default.
- **FR-W9.** A manual refresh button re-fetches the currently selected developer's data, bypassing the cache. Same 90s TTL as v0.1.
- **FR-W10.** Selection carry-over from the Sprint Board is **one-way and in-session only.** Changing the Workload selection does not affect the Sprint Board. A page reload clears the carry-over. Direct navigation to `/workload` without a prior Sprint Board selection shows the default empty state.

### 11.5 Layout sketch

```
┌──────────────────┬──────────────────────────────────────────────┐
│ DEVELOPERS       │  WORKLOAD — saubyk                           │
│ (left rail)      │                                              │
├──────────────────┤  ┌─ Assigned (12) ─┐  ┌─ Reviewing (8) ─┐    │
│ ▸ ellemouton     │  │  ◐ lnd      6   │  │  ◐ lnd      5   │    │
│ ▸ saubyk     ●   │  │  ◐ lit      4   │  │  ◐ lit      3   │    │
│ ▸ bitromortac    │  │  ◐ tap      2   │  └─────────────────┘    │
│ ▸ ziggie1984     │  └─────────────────┘                         │
│   …              │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

### 11.6 Technical notes

- **Data source.** GraphQL `search` connection, two queries per developer per configured org: `is:open assignee:<login> org:<org>` and `is:open review-requested:<login> org:<org>`.
- **Server-side aggregation.** Only `repository.nameWithOwner` is needed per result. The server reduces the response to `{ assigned: [{repo, count}], reviewing: [{repo, count}] }` so the frontend payload is tiny.
- **Search cap.** GitHub's search connection caps results at 1000 per query. If hit, fall back to per-repo iteration. Unlikely for a single developer's open work but should be guarded.
- **Permissions.** Resolving team membership requires `Members: Read` on every configured org — update the PAT-permissions section accordingly.
- **Charting.** Recharts. Declarative, ~93kb gzipped, the standard React choice for this shape of visualization.

### 11.7 Out of scope for v0.2

- Drill-down from a slice into the underlying issues/PRs.
- Closed or recently-merged items.
- Multi-developer side-by-side comparison.
- Slice weighting by anything other than count (priority-weighted load, aging, etc.).

---

## 12. Out of scope / future work

- Editing project fields (status, priority, size) from within the app.
- Sprint metrics: cycle time, review latency, P0 aging.
- Slack or email notifications ("you have 4 PRs waiting for your review").
- Hosted/multi-tenant deployment with OAuth.

---

## 13. Open questions

1. Should "team members" be inferred from the project (current proposal) or configured explicitly via a `team.json` file? Inferred is simpler; explicit lets PMs include teammates who happen to have no items this sprint.
2. For the review column, do we count PRs where the user has *already* approved? Proposal: hide them by default, with a toggle to show.
3. Do we want to surface draft PRs and items in `Backlog` status by default, or hide them? The reference screenshot includes Backlog items, so the proposal is to include them.
4. Should the app support GitHub Enterprise Server URLs in v1, or is `github.com` sufficient?
