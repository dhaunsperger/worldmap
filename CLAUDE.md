# worldmap — personal travel tracker

Single-user web app: a clickable scratch-style world map that tracks where the
owner has been. US states, Canadian provinces, and country-level everywhere
else. Left-click cycles a territory's status; trips (date ranges with attached
territories) add the time dimension.

## Architecture (decided 2026-07, do not re-litigate casually)

- **Frontend-only app**: Vite + React 18 + TypeScript SPA. No custom server.
- **Persistence**: Supabase (Postgres + Auth) via `@supabase/supabase-js`
  directly from the browser. RLS keeps rows scoped to the signed-in user.
- **Hosting**: Vercel (static Vite build). Owner has Vercel + Supabase accounts.
- **Map rendering**: single SVG, `d3-geo` (geoNaturalEarth1 projection),
  path strings computed once; pan/zoom via a transform on a `<g>`.

## Key concepts

- **Territory**: one clickable shape. Stable string ids:
  - US states/DC/territories: `US-CA`, `US-DC`, `US-PR`, … (USPS codes)
  - Canadian provinces/territories: `CA-ON`, `CA-QC`, … (ISO 3166-2 codes)
  - Countries: ISO 3166-1 numeric as string, e.g. `250` = France
    (that's what world-atlas ships; names live in the map file's properties).
- **Status**: `not_visited | visited | slept_in | lived_in`. Cycles in that
  order on left-click. `not_visited` = **no row** in `territory_status`
  (deleting the row, not writing a status, returns a territory to unvisited).
- **Trips**: first-class records (name, optional start/end dates, notes) with
  N territories via `trip_territories`. Status is deliberately independent of
  trips so old visits can be tracked with zero detail; saving a trip bumps any
  `not_visited` member territory to `visited` as a convenience.

## Files

- `public/territories.json` — generated TopoJSON (all clickable shapes with
  `{id, name, kind}` props). **Committed**; regenerate with `npm run build-map`.
- `scripts/build-map.mjs` — regenerates the above from Natural Earth /
  us-atlas / click_that_hood sources. See header comment for sources.
- `supabase/schema.sql` — full DB schema + RLS. Paste into Supabase SQL editor
  to (re)provision. Idempotent-ish: uses `create table if not exists`.
- `src/lib/statuses.ts` — the status cycle, labels, and scratch-map colors.
- `src/hooks/` — `useAuth`, `useStatuses`, `useTrips`: all Supabase I/O lives
  here (optimistic updates, no data layer beyond this).
- `src/components/MapView.tsx` — SVG map, pan/zoom, click handling.

## Gotchas / environment notes

- **Polygon winding**: d3-geo treats GeoJSON polygons as spherical; RFC7946
  (counterclockwise) rings render as "the whole world except the shape".
  `build-map.mjs` rewinds **per feature** (never per ring — Antarctica's
  pole-hugging outer ring alone measures ~4π even when correct). If the map
  ever renders as one giant filled blob, this is why.
- **Rapid clicks**: `useStatuses` mirrors state in a ref so multiple clicks
  between re-renders cycle correctly, and debounces writes 400 ms per
  territory so cycling sends one upsert, not three racing ones.
- **Demo mode**: `VITE_DEMO=1 npm run dev` skips Supabase entirely (in-memory
  data). Use it for UI work and Playwright verification — no credentials
  needed.
- **Verifying UI changes**: chromium lives at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in this container;
  drive the demo-mode dev server with playwright-core and dispatch synthetic
  `click`/`contextmenu` events on `path[data-territory-id=…]` (real
  coordinate clicks miss concave shapes).
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
- `.env.local` needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  (see `.env.example`). Missing env shows a setup screen instead of crashing.
- Left-click cycles status. Right-click (or long-press) opens the territory
  detail panel. While the trip editor is open, left-click **selects
  territories for the trip** instead of cycling status.

## Commands

- `npm run dev` — local dev server
- `npm run build` — typecheck + production build (what Vercel runs)
- `npm run build-map` — regenerate `public/territories.json`
