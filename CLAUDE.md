# worldmap — personal travel tracker

Single-user web app: a clickable scratch-style world map that tracks where the
owner has been. US states, Canadian provinces, and country-level everywhere
else. Left-click cycles a territory's status; trips (date ranges with attached
territories) add the time dimension.

## Architecture (rebased 2026-07 off Supabase, do not re-litigate casually)

- **Fully static app, no backend, no auth**: Vite + React 18 + TypeScript SPA.
  (v1 used Supabase; it was dropped because free-tier projects pause when
  idle. `scripts/supabase-export.sql` is the one-time rescue query.)
- **Persistence** (`src/lib/store.ts`, the only stateful module):
  - localStorage (`worldmap-data`) is the always-on source of truth.
  - Optional "sync file": a FileSystemFileHandle picked by the user, persisted
    in IndexedDB (`worldmap` db, `handles` store), auto-written (debounced
    800 ms) after every change. The owner keeps it in OneDrive for cloud sync.
  - On startup, newer `updated_at` wins between file and localStorage.
  - Export/Import JSON buttons for manual backup — Import also accepts the
    Supabase rescue-export shape (`exported_at` instead of `updated_at`).
- **Hosting**: Vercel static build (no env vars needed).
- **Map rendering**: single SVG, `d3-geo` (geoNaturalEarth1 projection),
  path strings computed once; pan/zoom via a transform on a `<g>`.

## Key concepts

- **Territory**: one clickable shape. Stable string ids:
  - US states/DC/territories: `US-CA`, `US-DC`, `US-PR`, … (USPS codes)
  - Canadian provinces/territories: `CA-ON`, `CA-QC`, … (ISO 3166-2 codes)
  - Countries: ISO 3166-1 numeric as string, e.g. `250` = France
    (that's what world-atlas ships; names live in the map file's properties).
- **Status**: `not_visited | visited | slept_in | lived_in`. Cycles in that
  order on left-click. `not_visited` = **no key** in `data.statuses`.
- **Trips**: name, optional start/end dates, notes, N territories, each
  carrying its own status (`visited` or `slept_in` — the editor's two
  drag-and-drop boxes). Status is deliberately independent of trips so old
  visits can be tracked with zero detail; saving a trip **raises** each member
  territory to at least the trip's status (never downgrades — see
  `raiseStatus`/`STATUS_RANK`). Deleting a trip offers to re-derive statuses
  from remaining trips (lived_in is never touched — trips can't set it).

## Files

- `public/territories.json` — generated TopoJSON (all clickable shapes with
  `{id, name, kind}` props). **Committed**; regenerate with `npm run build-map`.
- `scripts/build-map.mjs` — regenerates the above from Natural Earth /
  us-atlas / click_that_hood sources. See header comment for sources.
- `src/lib/store.ts` — ALL persistence + domain actions (statuses, trips,
  file sync, import/export). React binds via `useAppStore()`
  (useSyncExternalStore). No other module touches storage.
- `src/lib/statuses.ts` — the status cycle, labels, and scratch-map colors.
- `src/components/MapView.tsx` — SVG map, pan/zoom, click handling.
- `src/components/DataMenu.tsx` — the header Data menu (sync file, import,
  export) with its colored state dot.

## Gotchas / environment notes

- **Polygon winding**: d3-geo treats GeoJSON polygons as spherical; RFC7946
  (counterclockwise) rings render as "the whole world except the shape".
  `build-map.mjs` rewinds **per feature** (never per ring — Antarctica's
  pole-hugging outer ring alone measures ~4π even when correct). If the map
  ever renders as one giant filled blob, this is why.
- **Map clicks are NOT path onClick**: pointer capture during pan retargets
  pointerup (and the derived click) to the `<svg>`, so path `onClick` silently
  never fires on real hardware (synthetic dispatched clicks DO fire — which is
  how this shipped broken once; always verify with real `page.mouse.click`).
  `MapView` records the territory at pointerdown and resolves the click at
  pointerup if total movement stayed under 5 px. Don't reintroduce onClick.
- **File System Access API**: Chrome/Edge desktop only (`fileState:
  'unsupported'` elsewhere — Export/Import still works). Handles persist only
  via IndexedDB structured clone. After a browser restart `queryPermission`
  usually returns `'prompt'`; re-granting needs a user gesture → the Data menu
  shows "Reconnect" (`fileState: 'needs-permission'`). Never call
  `requestPermission` outside a click handler — it throws.
- **Rapid clicks**: `store.cycleStatus` reads `this.data` (always current, no
  React closure staleness). File writes are debounced 800 ms; localStorage is
  written synchronously on every change.
- **Verifying UI changes**: chromium lives at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in this container;
  drive the dev server (`npm run dev`, no config needed) with playwright-core
  and use REAL `page.mouse.click` at territory bbox centers of convex shapes
  (US-CO, US-KS…) — synthetic dispatched clicks mask pointer-capture bugs.
  File-picker linking can't be tested headless; everything else can.
- **Status colors** were validated with the dataviz skill's
  `validate_palette.js` against surface `#171c28` (dark mode, all six checks
  pass). They live in BOTH `src/lib/statuses.ts` and `src/styles.css`
  custom properties — keep them in sync, and re-validate if changed.
- **This dev container's proxy blocks most CDNs** (naciscdn.org, jsdelivr).
  `registry.npmjs.org` and `raw.githubusercontent.com` work. `build-map`
  fetches sources via `npm pack` + raw.githubusercontent for that reason.
- The map file mixes resolutions (50m countries, 10m US states, simplified
  Canada). Shared borders (US/Canada/Mexico) may have hairline mismatches —
  cosmetic, accepted.
- world-atlas numeric ids: Kosovo and N. Cyprus have odd/synthetic ids; ids
  are treated as opaque strings everywhere. Never parse them.
- Left-click cycles status. Right-click (or long-press) opens the territory
  detail panel. While the trip editor is open, left-click **selects
  territories for the trip** instead of cycling status.

## Commands

- `npm run dev` — local dev server (no configuration needed)
- `npm run build` — typecheck + production build (what Vercel runs)
- `npm run build-map` — regenerate `public/territories.json`
