# C3PO

Local web app that reorganizes a GitHub Project (v2) board around team
members instead of items. Three columns: assignees on the left, items
assigned to the selected person in the middle, PRs they're requested to
review on the right.

Single-user tool. Runs on your laptop, reads from `github.com` via a
Personal Access Token in a local `.env`. Read-only.

## Setup

```bash
cp .env.example .env
# fill in GITHUB_TOKEN and GITHUB_OWNER
npm install
npm start
```

Then open <http://localhost:3263>. You should see "Connected as @yourlogin."

## Layout

- `server/` — Express + TypeScript. Talks to GitHub via `@octokit/graphql`.
- `web/` — Vite + React + TypeScript + Tailwind. Calls `/api/*`.

Vite serves the app on `3263` (the port you visit). The Express API runs
on `5173` and Vite proxies `/api` to it, so the browser never sees the
GitHub token.
