# Horse Blanket Recommender — Project Context

_Last updated: 2026-04-08_

This file is a running summary of what this project is, how it's built, where it's deployed, and what's been done in recent Claude conversations. If a new Claude session picks this up, read this first.

---

## What it is

A simple web app for **Shelagh**, a horse trainer who manages ~20 horses. Every morning she needs to decide which blanket combination each horse wears based on the day's temperature. This app replaces the mental math:

1. Pick a temperature range from a dropdown.
2. See the recommended blanket combo (e.g. `300g + Neck cover + Hood`).

Settings (blanket library + temperature bands) are editable on the same page. Multiple "groups" of horses can be set up with different configurations.

---

## Folder location

```
/Users/Claude/ALL CLAUDE STUFF/PROJECTS (ACTIVE)/
└── SHELAGH/
    └── Farm Projects/
        └── horse-blanket-recommender/
            ├── index.html       ← the entire frontend (HTML + CSS + JS in one file)
            ├── server.js        ← Express server: basic auth + /api/data CRUD
            ├── package.json     ← Node deps (express, express-basic-auth)
            ├── Dockerfile       ← Node 20 Alpine image for Railway
            ├── .gitignore
            └── CONTEXT.md       ← this file
```

`SHELAGH/` is the umbrella folder for all of Shelagh's projects. `Farm Projects/` is the category for horse/farm-related work. New SHELAGH projects of other kinds can be siblings of `Farm Projects/`.

---

## Architecture

**Frontend** — single `index.html` file. Vanilla JS, no build step, no framework. State lives in a `state` object with shape:

```js
{
  activeGroupId: "g_abc",
  groups: [
    {
      id: "g_abc",
      name: "My horses",
      blankets: [{ id, name, notes }],
      bands:    [{ id, min, max, blanketIds: [] }]
    }
  ]
}
```

**Storage**:
- `localStorage` key `shelagh.blankets.v1` — instant offline cache
- `GET /api/data` and `PUT /api/data` on the server — cross-device sync via a JSON file on a Railway Volume mounted at `/data/data.json`

**Save flow** (`save()` in index.html):
1. `localStorage.setItem(...)` immediately (synchronous, can never be lost)
2. `pushToServer()` debounces a `PUT /api/data` for 600ms
3. On `visibilitychange` / `pagehide` / `beforeunload`, `flushSave()` uses `navigator.sendBeacon` (with `keepalive` fetch fallback) so any pending debounced save lands before the tab closes

**Load flow** (`load()` in index.html):
1. Try `GET /api/data` first
2. Fall back to `localStorage`
3. Fall back to `defaultData()` (a single seeded "My horses" group with -30°C → +46°C bands in 2°C increments)

**Server** (`server.js`):
- Express + `express-basic-auth` gating every request via `AUTH_USER` / `AUTH_PASSWORD` env vars
- Atomic writes (write to `data.json.tmp`, then rename — POSIX-atomic on the same filesystem)
- Static file serving for `index.html`

---

## Deployment

**GitHub**: https://github.com/claudechopper/horse-blanket-recommender (public)

**Railway**:
- Project: `7d6f8e9b-752b-4563-b21a-21a73d270431`
- Service: `horse-blanket-recommender` (`58efa98a-96ed-4200-ba5b-6cf027a3d34e`)
- Volume mounted at `/data` (persists `data.json` across deploys)
- Env vars: `AUTH_USER=user`, `AUTH_PASSWORD=hummingbird`
- Deploys via `~/bin/railway up --detach --service horse-blanket-recommender` from the project directory
- CLI binaries (`gh`, `railway`) live in `~/bin/` — installed manually because brew/node weren't available

**Deploy workflow**:
```bash
cd "/Users/Claude/ALL CLAUDE STUFF/PROJECTS (ACTIVE)/SHELAGH/Farm Projects/horse-blanket-recommender"
git add -A
git commit -m "..."
git push
~/bin/railway up --detach --service horse-blanket-recommender
```

---

## Features (what's actually built)

### Daily-use UI (top of page)
- Big "What blankets today?" card
- Single dropdown of temperature bands (e.g. `-2° to 0° C`)
- Recommended combo displayed as labeled chips

### Visual scheme strip
- Horizontal flex-wrap strip showing all bands as colored segments (cool blue → warm orange via HSL interpolation)
- Click any segment to jump to that range in the dropdown above

### Settings (collapsible, ALL CAPS summary, big arrow)
- **Blanket Library**: name + notes columns, add/delete rows
- **Temperature Bands**: min, max, multi-select checkboxes for blankets, auto-sorted, overlap/gap warnings
- **Backup**: Export all data as timestamped JSON, Import from file (with confirm)

### Multi-group support
- Group switcher in the title area: dropdown + New / Rename / Delete buttons
- New groups are automatically seeded with the same defaults as the first group (no popup)
- Each group has its own independent blankets + bands

### Cross-device + responsive
- Works on iPhone, iPad, and desktop
- PWA meta tags so iOS "Add to Home Screen" gives a real app icon and full-screen chrome
- Inline SVG `apple-touch-icon`
- `safe-area-inset` padding for iPhone notch / home indicator
- Tablet breakpoint (641–1024px) with larger touch targets, 44px minimum hit area
- `-webkit-text-size-adjust: 100%` to prevent iOS auto-zooming

---

## Recent conversation history

### Conversation 1 (planning + initial build)
- Created `SHELAGH/` folder, planned the app, built the single `index.html` with vanilla JS + localStorage
- Temperature range -30°C → +46°C in 2°C bands
- Added "Notes" column header, made Settings ALL CAPS / collapsed by default / 75% bigger arrow / iPhone-friendly
- Pushed to GitHub + Railway (initially with Caddy, later replaced with Node/Express)
- Added multi-group support with the group switcher
- Removed the "seed vs empty" confirm popup; new groups always auto-populate
- Added password protection + cross-device sync (Express + basic auth + Railway Volume + atomic writes)

### Conversation 2 (this one — picked up after compaction)
- Verified iPhone/iPad/desktop responsive layout, added PWA meta tags, safe-area padding, tablet breakpoint, apple-touch-icon
- Added **Backup** block in Settings: Export (downloads timestamped JSON), Import from file
- Hardened save flushing: `visibilitychange` / `pagehide` / `beforeunload` listeners + `sendBeacon` / `keepalive` fetch so saves are never lost mid-debounce
- Renamed app from "Shelagh's Horse Blanket Recommender" → "Horse Blanket Recommender" (title, h1, basic auth realm)
- Reorganized folders: project moved from `SHELAGH/horse-blanket-recommender/` to `SHELAGH/Farm Projects/horse-blanket-recommender/` (the previous structure had ended up as a single folder literally named `SHELAGH:Farm Projects` due to a slash-vs-colon mishap; that's been fixed into proper nested folders)
- Wrote this CONTEXT.md file

---

## Known scope decisions

- **Celsius only** — no °F toggle
- **No weather API** — Shelagh wanted to pick temperature manually
- **Single user** — last write wins, no concurrency control beyond atomic file rename
- **No per-horse profiles** — all horses in a group get the same recommendation. (If she ever needs "this horse runs hot," that's a v2 feature: add a "groups" concept already exists, so she can just make a hotter group.)
- **No cloud sync between accounts** — single shared login, single JSON file
- **No mobile-specific layout** — but it is fully responsive

---

## Out of scope (deferred)

- Weather API integration
- Per-horse profiles
- Wind / rain adjustments
- Multi-user accounts
- Native mobile app

---

## How to verify it's working

1. Open the Railway URL, log in as `user` / `hummingbird`
2. You should see the "What blankets today?" card and seeded default group
3. Pick a range — combo card appears
4. Open Settings, edit a blanket name, reload — change persists
5. Edit on phone, reload on laptop — change syncs
6. Click Export — a `shelagh-blankets-YYYY-MM-DD-HH-MM-SS.json` file downloads
