# Decisions

For each major architectural choice in v1, the alternatives considered, the reason for the pick, and what would trigger reconsideration. Read this when something feels weird and you wonder why.

---

## 1. ngrx/signals over hand-rolled signals or ngrx/store

*Picked:* @ngrx/signals (purpose-built signals store).

*Alternatives:*
- *Hand-rolled signal services* — full control, no library dep. Rejected because every store would reinvent entities[], loading, error, withMethods plumbing. The boilerplate would drift across stores within a month.
- *ngrx/store* (the classic) — proven, large ecosystem. Rejected because actions/reducers/selectors/effects are heavy ceremony for a local-first app with no async middleware needs. Signals are Angular's native primitive now; using observables to wrap them is going backwards.

*Why ngrx/signals wins here:*
- Native signals → no subscribe lifecycle bugs.
- signalStore + withState + withComputed + withMethods gives every entity store the same shape with ~30 lines of code.
- providedIn: 'root' for global stores; per-component providers: [...] for ephemeral flow state (the Add-place facade).

*Reconsider when:* if the app needs cross-cutting middleware (logging, undo/redo, time-travel debugging), classic ngrx/store with effects might pay back the ceremony.

---

## 2. Storage adapter pattern (interface + DI token)

*Picked:* StorageAdapter interface, bound via STORAGE_ADAPTER injection token to LocalStorageAdapter (Dexie/IndexedDB).

*Alternatives:*
- *Direct Dexie calls from stores* — simpler, fewer files. Rejected because v2's backend swap would touch every store. Doing it now means v2 is a 1-week wire-up.
- *Repository pattern (one repo per entity)* — more granular. Rejected because seven repository interfaces and seven implementations is more surface area than one StorageAdapter interface, with no behavioral benefit.

*Why the single adapter wins:*
- Stores depend only on StorageAdapter, never on Dexie or IndexedDB.
- app.config.ts is the *single point* where the app says "here's where data lives." v2 changes that one line.
- Test fakes are trivial: fakeStorageAdapter() in src/app/testing/fake-storage.ts is an in-memory implementation tests inject directly.

*Reconsider when:* if entity-specific operations get complex (e.g. SQL-style joins for "places in collections"), a per-entity repository pattern starts looking saner.

---

## 3. Plain CSS variables over Tailwind / SCSS modules

*Picked:* Plain CSS with var(--wf-*) design tokens, per-component styles.

*Alternatives:*
- *Tailwind* — fast prototyping, utility-first. Rejected because the seven themes need full design-system swaps (typography, border radii, glow intensities, pin shapes), and Tailwind's theme system optimizes for color/spacing, not arbitrary tokens. The result would be a Tailwind config nearly as long as just writing CSS.
- *SCSS modules* — traditional, organized. Rejected because we don't need @mixin, @function, or nesting — modern CSS handles all of it. Adding SCSS means adding a build step that buys nothing.

*Why plain CSS wins:*
- The mockup is plain CSS variables. Porting is one-to-one.
- Theme switching is <html data-theme="neon">. No JS bundle changes, no rebuilds.
- Adding a new theme = one file under styles/themes/. No config to update.
- Component CSS files stay readable for anyone who knows CSS.

*Reconsider when:* if global CSS class collisions become a problem (multiple developers, large team), CSS modules or scoped styles become worth the build complexity. For a personal app, plain CSS is correct.

---

## 4. Vitest over Karma + Jasmine

*Picked:* Vitest (Angular 21's CLI default).

*Alternatives:*
- Karma + Jasmine — the historical Angular default. Real-browser test runner. Rejected because Angular 21 deprioritized it in favor of Vitest.
- Jest — popular, but Angular's tooling support is uneven.

*Why Vitest wins here:*
- It's what ng new gives you in Angular 21. No config drift.
- Significantly faster than Karma — runs in Node with jsdom rather than spinning up Chrome.
- Modern API similar to Jest, easy to read.
- First-class TypeScript support.

*Reconsider when:* you specifically need real-browser test execution (e.g., for Leaflet's DOM rendering). At that point, Playwright Component Tests is a better choice than going back to Karma.

---

## 5. Hybrid core/ + features/ folder structure

*Picked:* core/ for shared infrastructure, features/ for UI feature modules.

*Alternatives:*
- *Feature-based* (features/places/, features/trips/ only) — each feature is fully self-contained. Rejected because cross-cutting concerns (geocoding, theme, storage) would either duplicate across features or end up in a misnamed "shared" folder.
- *Layer-based* (components/, services/, models/ only) — traditional Angular. Rejected because as the app grows, the components/ folder becomes a dumping ground with no relationship between siblings.

*Why hybrid wins:*
- core/ answers: "what's used by multiple features?" (storage, models, stores, services).
- features/ answers: "what UI screen is this?" (home, places, trips, settings).
- shared-ui/ (when populated) answers: "what UI atom is reused?" (modal, chip, toast).

- The one-way import rule (features → core, never reverse) keeps the dependency graph clean and prevents circular imports.

*Reconsider when:* if a single feature grows huge enough to warrant its own internal sub-organization (its own services/, stores/, components/), promote it to a top-level folder peer of core/ and features/. Rare for a personal app.

---

## 6. No backend in v1, but data shape designed for one

*Picked:* Local-first IndexedDB, but every entity has stable UUIDs, createdAt / updatedAt timestamps, soft-delete deletedAt, and stubbed userId / ownerId / collaboratorIds / visibility.

*Alternatives:*
- *Pure local-first without sync stubs* — simpler v1 schema. Rejected because v2's migration would mean schema changes to every record, every export file, every test fixture.
- *Backend from day 1* — Supabase free tier is real. Rejected because it adds a sign-up flow, an auth UX, a privacy story, and a "what if the server goes down" UX — none of which serves the personal-use-first audience.

*Why "design for backend, build for local" wins:*
- v1 ships with the strongest privacy promise possible: nothing ever leaves the device.
- v2 migration is purely additive: write SupabaseAdapter, swap one line in app.config.ts, deal with auth UI. The schema doesn't change.
- The cost in v1 is small: a few unused fields in TypeScript types and an extra deletedAt filter in the storage adapter's reads.

*Reconsider when:* the spec's Section 10 ("Backend — Future Reference of Back to the Past") gets revisited at v2 kickoff. The locked decisions there (magic links, Google OAuth, multi-user direction) constrain architecture choices.

---

## 7. Standalone components, no NgModules

*Picked:* Every component is standalone. No NgModules anywhere.

*Alternative:* Module-based (the pre-Angular-14 pattern). Rejected because Angular 19 makes standalone the default for new projects, and NgModules are deprecated in spirit if not officially.

*Why standalone wins:*
- Lazy-loaded routes use loadComponent: () => import(...) directly. No loadChildren indirection.
- Component dependencies are explicit in imports: [...]. Easy to read.
- No declarations / exports / providers ceremony per module.

*Reconsider when:* never. NgModules are not coming back.

---

## 8. Leaflet + OpenStreetMap over Mapbox / Google Maps

*Picked:* Leaflet 1.9 with OpenStreetMap tiles.

*Alternatives:*
- *Mapbox GL JS* — beautiful, smooth, vector tiles. Rejected because it requires an API key, has a free-tier MAU cap, and bundles a much heavier runtime.
- *Google Maps JS API* — familiar, comprehensive. Rejected because pricing is per-load, requires a key with billing enabled, and the visual style locks you to Google's design language.

*Why Leaflet wins:*
- 100% free for personal/open-source use, no key required.
- Tiny core (~40KB) + small ecosystem (markercluster, draw, etc.).
- OpenStreetMap tiles are free and good enough; in Settings → Advanced (TODO) the user can swap to MapTiler / Stamen / Stadia for different visual styles.
- The "Open trip in Google Maps" export means we get Google's routing for free without depending on it for display.

*Reconsider when:* if vector tiles + 60fps panning become a feature requirement, Mapbox/MapLibre is the path.