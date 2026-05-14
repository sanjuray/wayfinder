# Wayfinder

*the map of your maybe-someday.* / *pin it. plan it. go.*


A personal places-and-routes web app. Save spots from Google Maps links, organize them into collections with categories and vibe tags, plan multi-stop trips, and export to Google Maps for actual navigation.

*Status:* v1 baseline. Local-first (IndexedDB), no backend, no telemetry.

## Quick start

```bash
npm install
npm start         # http://localhost:4200
npm test          # Vitest
npm run build     # production build
```

## Documentation

- [`RUNNING.md`](./RUNNING.md) — full setup, troubleshooting, and what each command does
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — folder layout, signals vs services, naming, error handling
- [`DECISIONS.md`](./DECISIONS.md) — why each major choice (ngrx/signals, adapter pattern, plain CSS, Karma)

## What's in v1 (this baseline)

- ✅ Full Angular 19 project structure (standalone components, signals)
- ✅ Seven themes via plain CSS variables (paper, neon, kyoto, mono, midnight, subway, forest)
- ✅ Storage adapter pattern (IndexedDB v1, swappable for cloud in v2)
- ✅ All entity stores (places, collections, trips, categories, vibe tags) with auto-seeded defaults
- ✅ Home map with Leaflet + OpenStreetMap, marker clustering, click-to-add, pan-to-saved-pin
- ✅ Add-place flow end-to-end: 4-step modal → geocoding → persist → celebration
- ✅ Pin-drop celebration animated at the saved pin's lat/lng
- ✅ Theme switcher in Settings
- ✅ Time-of-day tagline shuffle


## What's TODO (spec sections deferred)

- JSON export/import UI
- File System Access API folder picker (first-run welcome)
- Collections detail / Trips list / Trip plan screens
- Validation states for invalid Google Maps short links
- Full keyboard accessibility audit