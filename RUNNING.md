# Running Wayfinder

## Prerequisites

- *Node.js 20.11.x or newer* (Angular 19 requires it)
- *npm 10.x or newer* (comes with Node 20)
- A modern browser (Chrome, Edge, Firefox, Safari)

Check your versions:
```bash
node --version
npm --version
```

## First-time setup

```bash
cd wayfinder
npm install
```

This installs Angular 19, ngrx/signals, Leaflet, leaflet.markercluster, Dexie, uuid, and dev dependencies (Karma, Jasmine, TypeScript, Prettier).

If 'npm install' fails:
- Make sure your Node version is at least 20.11.0
- Delete node_modules and package-lock.json, try again
- On macOS, if node-gyp complains, run xcode-select --install

## Run dev server
```bash
npm start
```

Opens on http://localhost:4200. Hot reload is on — save any file and the browser refreshes.

You should see:
- A topbar with the wayfinder logo + wordmark + time-of-day tagline
- A sidebar with empty Categories list (will populate on first DB seed) and empty Collections
- A full Leaflet map of Tokyo (default starter view)
- A "+ Add a place" FAB bottom-right

## First interactions to test

1. *First load* — IndexedDB seeds 14 categories + 10 vibe tags. Sidebar shows them after a refresh.
2. *Click anywhere on the map* — opens the Add-place flow with that lat/lng pre-filled at step 2.
3. *Click the FAB* — opens the Add-place flow at step 1 (paste-link).
4. *Paste a Google Maps URL or type an address* — geocodes via Nominatim, advances to step 2.
5. *Complete all 4 steps and Drop pin* — modal closes, map flies to the pin, celebration plays.
6. *Open Settings → Theme* — click any of the 7 themes, watch the whole UI re-skin live.

## Run tests
```bash
npm test
```

Vitest launches headless Chrome and runs the spec files. Currently:
- add-place.facade.spec.ts — facade orchestration tests

To watch tests as you code:

```bash
npm test -- --watch
```

## Production build

npm run build

Outputs to dist/wayfinder/. Serve with any static host.


## Common issues

### "leaflet is not defined" in console
Make sure leaflet is in package.json and you ran npm install after pulling. Leaflet's CSS is loaded via angular.json styles array — verify node_modules/leaflet/dist/leaflet.css exists.

### Map shows but tiles are blank
You're offline, or OpenStreetMap is rate-limiting your IP. Switch tile providers in home.component.ts (TODO: expose this in Settings → Advanced).

### Geocoding requests fail with CORS
Nominatim is rate-limited (~1 req/sec). If you make too many requests, OSM may temporarily block. Wait 60 seconds and retry. For high volume, switch to a paid geocoder (MapTiler, Photon).

### IndexedDB doesn't seed defaults
Open DevTools → Application → IndexedDB → wayfinder → categories. If empty, the seeding logic in categories.store.ts should populate on the next page load. If still empty, clear the database and refresh.

### Theme switcher doesn't work
Check <html data-theme="..."> in DevTools. If empty, ThemeService.apply() isn't being called. Verify AppStateStore.load() runs in app.component.ts
ngOnInit.

### "Cannot find module '@ngrx/signals'"
Run npm install @ngrx/signals@19. The version must match Angular's major version.

## Project structure cheat sheet
```
src/app/
├── core/        ← shared infra; never imports from features
│   ├── models/      domain types
│   ├── storage/     adapter pattern (Dexie v1, Supabase v2-ready)
│   ├── services/    stateless logic (geocoding, theme, tagline, id, link parsing)
│   ├── stores/      ngrx/signals stores (one per entity)
│   └── seed/        default categories + vibe tags
└── features/    ← UI; one folder per feature
    ├── home/         the map screen
    ├── places/       Add-place flow (the reference feature)
    ├── collections/  TODO
    ├── trips/        TODO
    └── settings/     theme switcher + about
```

For why these choices, see [`DECISIONS.md`](./DECISIONS.md).

## Reporting bugs

This is a v1 baseline — there will be rough edges. If npm start fails out of the box, the most useful info is:
1. node --version output
2. The exact error message from the terminal
3. Whether npm install completed without errors