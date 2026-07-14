---
name: verify
description: Build, launch, and drive C3PO (server + web) to verify changes end-to-end.
---

# Verifying C3PO

## Build / typecheck

```bash
npm run typecheck --workspace=web
npm run build --workspace=web
```

## Launch

```bash
npm start > /tmp/c3po-dev.log 2>&1 &   # server (port 5173) + vite (port 3263)
```

Needs the repo's `.env` (GITHUB_TOKEN, WORKLOAD_TEAMS) — already present.
Web UI: http://localhost:3263 (proxies `/api` to the server).

## Drive (headless)

Playwright is NOT a repo dep. Install it in a scratch dir:

```bash
cd <scratch> && npm init -y && npm i playwright && npx playwright install chromium
```

Gotchas learned the hard way:

- A fresh browser profile has empty localStorage → the Sprint Board shows
  "PICK A PROJECT TO BEGIN". Select a project first. Many visible projects
  are empty; probe `/api/projects` then `/api/projects/:owner/:number/items`
  from page context (`page.evaluate(fetch...)`) and pick one with items —
  "lnd v0.22" (lightningnetwork #19) is the real board.
- First items fetch for a big board takes 5–30s; wait for a selector
  (e.g. `section.mb-4`), not a fixed timeout.
- The rails are `ul[role=listbox]` with full keyboard nav (arrows/Enter/Esc).
- Workload legend rows are `button[title]` (title = full repo name). Don't
  use `button[aria-pressed]` — the COUNTS/% toggle matches it too.
- Item rows are `<a href*="github.com">` opening new tabs; assert via
  `page.waitForEvent("popup")`.

## Flows worth driving

- Board: pick project → group bands render; click an assignee → columns
  regroup by priority + dashed CLEAR FILTER appears; column filter input
  with garbage → droid empty state; row click → GitHub popup.
- Workload: a developer is auto-selected on entry; legend click → in-panel
  drilldown card (✕ closes, re-click toggles, switching dev clears);
  COUNTS/% flips legend values.
