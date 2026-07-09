# 🗺️ worldmap — Where I've Been

A personal travel tracker: a scratch-map-style clickable world map covering
**US states, Canadian provinces, and countries** everywhere else.

- **Left-click** a territory to cycle it: not visited → visited → slept in → lived in
- **Right-click** a territory for details: set status directly, see its trips, start a new trip
- **Trips** record when you were somewhere — an optional date range, notes, and
  any number of territories (click the map while editing to add/remove them)
- **Dashboard** shows progress bars (countries / US states / provinces),
  status counts, and trips by year

Built with Vite + React + TypeScript. Data lives in [Supabase](https://supabase.com)
(Postgres + auth); the app deploys as a static site (e.g. [Vercel](https://vercel.com)).

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. Open the project's **SQL editor** and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql).
3. From **Project Settings → API**, copy the project URL and the `anon` public key.

### 2. Local development

```sh
npm install
cp .env.example .env.local   # fill in the two values from step 3 above
npm run dev
```

Create your account with the sign-up form on first launch (email + password).

**No Supabase yet?** `VITE_DEMO=1 npm run dev` runs the full UI with in-memory
data — nothing is saved.

### 3. Deploy to Vercel

1. Import this repo in Vercel (it auto-detects Vite; build command `npm run build`,
   output `dist`).
2. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   in the Vercel project settings.
3. Deploy. Optionally disable new sign-ups afterwards in Supabase
   (**Authentication → Providers → Email**) since this is a single-user app.

## Regenerating the map

`public/territories.json` is committed. To rebuild it from sources
(Natural Earth 50m countries, US Census states, Canadian provinces):

```sh
npm run build-map
```

See `scripts/build-map.mjs` for source URLs and territory-id conventions
(`US-CA`, `CA-ON`, ISO numeric for countries).
