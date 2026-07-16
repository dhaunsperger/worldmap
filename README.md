# 🗺️ worldmap — Where I've Been

A personal travel tracker: a scratch-map-style clickable world map covering
**US states, Canadian provinces, and countries** everywhere else.

- **Left-click** a territory to cycle it: not visited → visited → slept in → lived in
- **Right-click** a territory for details: set status directly, see its trips, start a new trip
- **Trips** record when you were somewhere — an optional date range, notes, and
  any number of territories, each marked *visited* or *slept in* (drag between
  boxes in the editor; click the map while editing to add/remove places)
- **Dashboard** shows progress bars (countries / US states / provinces),
  status counts, and trips by year

Built with Vite + React + TypeScript. **No backend, no accounts** — the app is
a fully static site.

## Where the data lives

- Primary store: the browser's localStorage (instant, automatic).
- **Data → Create sync file…** links a JSON file via the File System Access
  API (Chrome/Edge on desktop); every change auto-saves to it. Put that file
  inside your **OneDrive** (or Dropbox/Drive) folder and you get cloud backup
  and machine-to-machine sync for free. On startup, if the file is newer than
  the browser copy (synced from another machine), the file wins.
- **Data → Export / Import JSON** works in every browser — use it for manual
  backups or to move data anywhere.

### Migrating from the old Supabase version

Run `scripts/supabase-export.sql` in the Supabase SQL editor, save the
result cell to a `.json` file, then **Data → Import JSON…** in the app.

## Development

```sh
npm install
npm run dev
```

No configuration needed.

## Deployment

Any static host. On Vercel: import the repo, defaults work (build
`npm run build`, output `dist`). No environment variables required — if the
old `VITE_SUPABASE_*` variables are still set, they're ignored and can be
deleted.

## Regenerating the map

`public/territories.json` is committed. To rebuild it from sources
(Natural Earth 50m countries, US Census states, Canadian provinces):

```sh
npm run build-map
```

See `scripts/build-map.mjs` for source URLs and territory-id conventions
(`US-CA`, `CA-ON`, ISO numeric for countries).
