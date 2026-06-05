# Wayfinder — Handover: Phase 9 onwards
 
This document hands off Wayfinder from the current conversation state. Paste
this doc plus the project zip at the start of the next conversation.
 
**Current state:** Phases 1 through 8 (Batch A included) are fully built and
delivered. Phase 9 (global search) is **not yet built**. The notes below
describe what Phase 9 should do, then list all remaining v1 and v2 work.
 
---
 
## 1. Project at a glance
 
**Wayfinder** is a personal places-and-routes app for tracking pinned locations,
grouping them into collections, and planning trips. Local-first — no backend in
v1. A Spring Boot backend is planned for v2 (see section 7).

**Stack**
- Angular 21 standalone components, OnPush change detection, zoneless
- @ngrx/signals for all entity state
- Leaflet + Leaflet.markercluster for the map
- Nominatim/OpenStreetMap for geocoding
- Dexie/IndexedDB via a StorageAdapter interface (swappable for HTTP in v2)
- Tabler icons (CDN webfont for display, @iconify-json/tabler for picker)
- Plain CSS with `--wf-*` tokens; 7 themes via `<html data-theme="...">`

**Architecture rules**
- `core/` → `features/` imports only (never the reverse)
- Each feature never imports from another feature
- Stores are the only things that touch StorageAdapter
- Every entity has `id`, `createdAt`, `updatedAt`, `deletedAt?` for v2 sync

—

## 2. What is built (phases 1–8 complete)
 
### ✅ Phase 1–3c
Address resolver, place card, settings page, topbar/sidebar, collection covers,
gradient picker, icon picker.
 
### ✅ Phase 4 — Collections
Collections list + detail view, gradient picker, inline "+ New collection" in
add-place, Settings "Open" links.
 
### ✅ Phase 5 — Places list
Places list at `/places`, card-row layout, long-press/right-click bulk select,
sort dropdown, CollectionPicker lifted to shared/.
 
### ✅ Phase 6 — Trip planner
Trip list (`/trips`), trip planner (`/trips/:id`), 2-col layout, leg separators
with haversine + mode-speed time, Google Maps export, picker column with filter,
undo-remove flow with ghost pin marker.

### ✅ Phase 6e — Trips list mockup-aligned
Composed subtitle, filter popover, mini-map preview cards, section icons + counts,
status pills. `cycling` travel mode removed; `motorcycle` added (Google
`travelmode=two-wheeler`). Unique trip names enforced.
 
### ✅ Phase 7 — Live trips
`Trip.startedAt`, `TripStop.visitedAt`. Hybrid start (manual or auto-start on
first visited-toggle). Avatar marker at last-visited stop. Split polyline
(visited solid teal / remaining dashed accent). Live-controls bar.
 
### ✅ Phase 7 followup
- Clickable number badge → fires visited toggle
- Visited-toggle labeled when trip is live ("Mark visited" / "Visited")
- Reset trip button below live-controls bar
- Duplicate trip on completed trips
- Avatar marker on-revisit fix (`mapReady` signal)

### ✅ Phase 7 followup #2
- Date picker: `showPicker()` fix; soft-disable on completed trips
- Stop card: 2-row layout (name on own row)
- Saved/unsaved indicator: reactive to `lastChangeAt` vs `lastBackupAt`
- `AppState.lastChangeAt` added; `recordChange()` wired into all stores

### ✅ Batch A — Polish + custom CRUD
- Theme reactivity for polyline color (home map effects track `themePreference`)
- "View all" past-trips truncation (threshold = 6, `pastExpanded` signal)
- Popover positioning refactor on collection-detail (`position: fixed` +
  `getBoundingClientRect`-based coords, viewport-edge clamping)
- `<wf-category-manager>` — add/edit/hide/delete; defaults hideable not deletable
- `<wf-vibe-tag-manager>` — name-only CRUD; same hide model
- `VibeTag.hidden` field added
- Pickers that choose categories/vibes (categorize-step, home sidebar,
  picker-column) now filter `hidden` ones out

### ✅ Map sidebar + filter state
- Categories/Collections/Vibes sidebar sections with truncation + show-more
- Filter popover rebuilt: `<wf-multi-select>` dropdowns for all three dimensions
- Trip picker (picker-column) adds Vibe Tags filter
- `FilterStateStore` upgraded: `selectedCollectionIds: string[]` (was single),
  `selectedVibeIds`, bulk setters, `toggleCollectionInPopover`,
  `toggleVibeInPopover`

---
 
## 3. What is NOT built — next phases in order

### 📋 Phase 9 — Global search (BUILD NEXT)
 
**Goal:** user taps the search icon in the workspace topbar (already visible but
disabled). A search bar appears. They type a place name, address, vibe, note, or
category and see a result list. Selecting a result opens the place on the map.
 
**Behavior spec (confirmed with user):**
- Topbar search button shows/hides the search bar. Toggle: open = visible,
  closed = hidden. Not a page-level thing — controlled from the shell.
- Search scope: **places only** (not trips, not collections).
- Searched fields: name, customName, displayAddress, locality, region, country,
  reviewText, customNotes, category name, vibe tag names, collection names.
- Match style: **fuzzy** (character-sequence match; every char of query appears
  in order in the target).
- Ranking: exact name → starts-with → contains → address → notes → category/vibe
  → fuzzy fallback (tier-based scoring, no external library).
- **Map page result UI:** floating pill over the map (matches mockup exactly —
  `position: absolute; top: 18px; left: 18px; width: 340px`). Results drop below
  the pill as a scrollable list. Selecting a result flies the map to the place
  and opens place detail.
- **Places page extension:** when search is open on `/places`, an inline search
  bar appears at the top of the list. Results are grouped by category. Selecting
  a result opens the place detail panel.

**Mockup reference:**
The mockup (`wayfinder-ways.txt`) shows the map search at line 637:
```
<div class="search">
  <i class="ti ti-search" style="color:var(--ink-faint);font-size:15px"></i>
  <input placeholder="Search your places, or jump to a city…" />
</div>
```
CSS at line 237:
```
.search { position:absolute; top:18px; left:18px; background:var(--bg);
  border-radius:var(--radius-pill); padding:11px 18px; display:flex;
  align-items:center; gap:10px; border:0.5px solid var(--hairline); width:340px;
  box-shadow:0 2px 12px rgba(0,0,0,0.04); z-index:3; transition:box-shadow .2s }
```
The search bar is **inside the map area**, not in the topbar.
 
**Architecture decision:**
The topbar button lives in `WorkspaceShellComponent`. The search bar lives in
`HomeComponent` (over the map) and `PlacesListComponent` (above the list). These
are sibling routes, not parent-child. The open/closed state should live in a
shared `SearchStateService` (`providedIn: 'root'`, one `isOpen` signal). Shell
writes to it; each page reads from it.
 
**New files to create:**
```
src/app/core/services/search-state.service.ts   [NEW — isOpen signal + toggle]
src/app/core/services/search.service.ts         [NEW — fuzzy scoring logic]
```
 
**Files to edit:**
```
src/app/features/workspace/workspace-shell.component.ts   [inject SearchStateService, call toggle()]
src/app/features/workspace/workspace-shell.component.html [bind .on class + (click) on search button]
src/app/features/home/home.component.ts                   [inject both services, add search state]
src/app/features/home/home.component.html                 [add floating pill + results inside .map-area]
src/app/features/home/home.component.css                  [add .search, .search-results, .sr-* styles]
src/app/features/places/places-list/places-list.component.ts  [inject + search state + groupedResults]
src/app/features/places/places-list/places-list.component.html [add search bar + grouped results at top]
src/app/features/places/places-list/places-list.component.css  [add .pl-search-* styles]
```
 
**SearchStateService (full implementation):**
```typescript
@Injectable({ providedIn: 'root' })
export class SearchStateService {
  readonly isOpen = signal(false);
  open(): void  { this.isOpen.set(true); }
  close(): void { this.isOpen.set(false); }
  toggle(): void { this.isOpen.update(v => !v); }
}
```
 
**SearchService scoring tiers:**
```
100 — exact name match (case-insensitive, trimmed)
 80 — name starts with query
 60 — name contains query
 40 — address / locality contains query
 30 — notes / review contains query
 20 — category / vibe / collection name match
  + fuzzy character-sequence bonus on each tier miss
```

Fuzzy match rule: every character of `needle` appears in `haystack` in order.
Only applied if `needle.length >= 3` (avoids spurious single-char matches).
Coverage threshold: `needle.length / haystack.length >= 0.15`.
 
**SearchResult shape:**
```typescript
export interface SearchResult {
  place: Place;
  score: number;
  matchFields: string[];   // which fields matched: 'name'|'address'|'notes'|'category'|'vibe'|'collection'
  snippet: string;         // best matching text for display
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}
```

**Shell template change** (the only change to shell):
```html
<!-- Before: disabled button with "coming soon" -->
<button class="iconbtn" title="Search — coming soon" disabled>
  <i class="ti ti-search"></i>
</button>
 
<!-- After: active button, .on when search is open -->
<button
  class="iconbtn"
  [class.on]="search.isOpen()"
  (click)="search.toggle()"
  aria-label="Search"
>
  <svg ...search icon...></svg>
</button>
```
 
**Home template — add inside `.map-area` before the filter-pill:**
```html
@if (searchState.isOpen()) {
  <div class="search">
    <i class="ti ti-search" ...></i>
    <input class="search-input" [ngModel]="searchQuery()" ... autofocus />
    @if (searchQuery()) {
      <button class="search-clear" (click)="searchQuery.set('')">×</button>
    }
  </div>
  @if (searchQuery().trim()) {
    <div class="search-results">
      <!-- result rows -->
    </div>
  }
}
```
 
Filter pill condition: add `&& !searchState.isOpen()` so it hides while
searching.
 
**Result fly-to behavior:** selecting a result calls `map.flyTo(place coords)`,
waits 100ms (map may be animating), then calls `placeDetail.open(id)`.
**Places page grouped results:** results grouped by `categoryName`, each group
with a header row (icon + name + count) and place rows beneath. Groups sorted
by highest-scoring result in the group descending.
 
---
 
### 📋 Phase 10 — Mobile responsive audit
 
**Goal:** app works properly on a 390px phone screen. This is a pure CSS+layout
pass — no new features.
 
**Known pain points:**
- Trip planner 2-col layout (stops LEFT, map RIGHT) collapses poorly on mobile.
Needs to become single-column (map on top, stops below OR toggle between the two).
- Home sidebar is too wide on 375px; should collapse to a bottom drawer or a
  compact row of icon-only filters.
- Touch targets throughout: minimum 44×44px (especially iconbtns and the
  visited-toggle).
- Trip stop card note textarea is too cramped on narrow screens.
- The trip live-controls bar overflows on narrow viewports even after the reset
  button was moved out (need to verify).
- Filter popovers: on narrow screens the 300px min-width may clip viewport edge.

**Files likely affected:**
```
home.component.css                                [sidebar responsive]
trip-plan.component.css         
[2-col → single col at breakpoint]
trip-stop-card.component.ts (inline styles)       [touch target sizing]
trips-so-far.component.css                        [card grid already responsive — verify]
workspace-shell.component.css                     [topbar layout on narrow viewport]
filter-popover.component.ts (inline styles)       [popover width clamping]
```
 
**Breakpoints to test:** 375px (iPhone SE), 390px (iPhone 14), 430px (iPhone 14
Plus). Chrome DevTools → device toolbar is sufficient for initial audit.
 
—

### 📋 Phase 8 — Keyboard shortcuts + a11y audit
 
**Goal:** power users can navigate without a mouse; screen reader users have a
functional experience.
 
**Keyboard shortcuts (confirmed scope):**
- `/` or `Cmd+K` — open search
- `Escape` — close any open modal/panel/popover
- `N` — new place (when map is focused)
- Arrow keys — navigate search results
- `Enter` — select focused search result
**A11y items:**
- Map pins: `aria-label` with place name + category + status
- Sidebar filter items: `aria-pressed` when active
- Trip stop cards: announce visited-toggle state change
- Settings scroll-spy nav: `aria-current="section"` on active nav item
- Add-place modal: focus trap + return focus to trigger on close
- All `iconbtn` elements: `aria-label` audit (many currently rely on `title` only)

**Files affected:**
```
home.component.html / .css              [pin click handlers, sidebar aria]
trip-stop-card.component.ts             [aria-pressed on visited toggle]
workspace-shell.component.ts            [keyboard listener for / and Cmd+K]
add-place.component.ts                  [focus trap]
settings.component.ts                   [scroll-spy aria-current]
```
 
---
 
### 📋 Phase 11 — Onboarding / first-run
**Goal:** a new user opening the app for the first time sees a guided
introduction rather than an empty map.
 
**Scope (minimal viable):**
- First-launch detection via `AppState.hasCompletedOnboarding: boolean`
- Three-step overlay: what is Wayfinder / tap the map to add your first place /
  search is your memory
- Auto-dismisses on first place saved

**Files to create:**
```
src/app/features/home/onboarding-overlay.component.ts  [NEW]
```
 
**Files to edit:**
```
src/app/features/home/onboarding-overlay.component.ts  [NEW]
```
 
**Files to edit:**
```
src/app/core/models/app-state.model.ts    [add hasCompletedOnboarding field]
src/app/core/stores/app-state.store.ts    [add completeOnboarding() method]
src/app/features/home/home.component.ts   [show overlay if !hasCompletedOnboarding]
```
 
—

## 4. v2 deferred features (not for v1 dev)
 
These are known, scoped, intentionally deferred. Don't build any of these before
v1 is complete.
 
**Model gaps (frontend only, no backend needed):**
- Trip-only stops: `TripStop` with `inlineName + inlineLat + inlineLng` instead
  of `placeId`. Touches trip planner stop card rendering, polyline, Google Maps
  export, mini-map preview — ~10 files. Own phase.
- Editable `displayAddress` on place detail. Open design question: does editing
  the address also re-geocode and move the pin? Three options documented
  previously (independent edit, re-geocode-and-move, or show both).
- `customName` backfill for places saved before Phase 6d-final.
- Visit history UI. `Visit[]` array exists on Place but nothing writes to it or
  displays it. Phase 13 in the original plan.

**Backend-dependent (needs Spring Boot):**
- Multi-user / group collaboration
- Real-time trip sharing (collaborators see live trip state)
- Semantic search via pgvector + embeddings
- Trip summary and place recommendations via LLM
- Export/share as link or PDF

---
 
## 5. Key architectural decisions — running list
 
### StorageAdapter interface is the backend migration seam
 
`STORAGE_ADAPTER` token in `src/app/core/storage/storage.token.ts` currently
points to `DexieStorageAdapter`. In v2, swap it for `HttpStorageAdapter` that
calls Spring Boot endpoints. Stores don't change — they only call the adapter.
 
### FilterStateStore shape (as of Batch A)
```typescript
interface FilterState {
  selectedCategoryIds: string[];
  selectedCollectionIds: string[];   // was single ID pre-Batch A
  selectedVibeIds: string[];
  selectedLocality: string | null;
  selectedStatuses: PlaceStatus[];
  favoriteOnly: boolean;
}
```
 
All toggle methods on the store: `toggleSidebarCategory`, `toggleCategoryInPopover`,
`toggleSidebarCollection`, `toggleCollectionInPopover`, `toggleSidebarVibe`,
`toggleVibeInPopover`, `setSelectedCategoryIds`, `setSelectedVibeIds`,
`setSelectedCollectionIds`, `setLocality`, `clearAll`.
 
### AppState.lastChangeAt drives the saved indicator

`lastChangeAt` is set by `recordChange()` after every user mutation in every
store. Compared against `lastBackupAt` in the workspace shell. The dot in the
topbar shows teal (saved) when `lastChangeAt === undefined || lastChangeAt <=
lastBackupAt`; shows accent/coral (unsaved) otherwise.
 
`recordBackup()` clears `lastChangeAt` and sets `lastBackupAt = now`.
 
### TravelMode enum
 
Current values: `'auto' | 'walking' | 'driving' | 'motorcycle' | 'transit'`.
`cycling` was removed. Legacy `cycling` data is migrated to `'auto'` in
`TripsStore.load()`. Google Maps maps `motorcycle` → `travelmode=two-wheeler`.
 
### Trip lifecycle states
 
Derived from `Trip.startedAt?: ISODate` and `Trip.isCompleted: boolean`:
| Store section | Condition |
|---|---|
| inProgress | `startedAt != null && !isCompleted` |
| upcoming | `!startedAt && !isCompleted && plannedDate >= today` |
| drafts | `!plannedDate && !startedAt && !isCompleted` |
| past | `isCompleted` OR `(!startedAt && plannedDate < today)` |
 
### Category + VibeTag hidden model
 
`Category.hidden: boolean` and `VibeTag.hidden?: boolean` (optional, default
false). Components that **display assigned** categories/vibes (place cards,
trip stop cards, map marker tooltips) use `entities()` directly — hidden data
is still real. Components that **pick** categories/vibes (categorize-step, home
sidebar, picker-column) filter `!c.hidden`.

### Popover positioning (collection-detail)
 
Both menus (`showCoverMenu`, `showOverflowMenu`) use `position: fixed` with
coords captured at open-time from `getBoundingClientRect()`. The menu stays
where it opened if the user scrolls — acceptable for a transient menu.
Two helpers: `computeLeftAnchoredPos(target)`, `computeRightAnchoredPos(target)`.
 
### mapReady signal (trip planner)
 
The `avatarMarker` effect includes `this.mapReady()` as a signal dependency.
`mapReady` is a `signal(false)` that flips to `true` inside `initMap()`. This
ensures the effect re-fires on route revisit when all other signals are already
stable.
 
—

### mapReady signal (trip planner)
 
The `avatarMarker` effect includes `this.mapReady()` as a signal dependency.
`mapReady` is a `signal(false)` that flips to `true` inside `initMap()`. This
ensures the effect re-fires on route revisit when all other signals are already
stable.
 
---
 
## 6. File inventory (complete, as of Batch A)
 
```
src/app/
├── core/
│   ├── constants/
│   │   └── collection-covers.ts
│   ├── models/
│   │   ├── app-state.model.ts        [lastChangeAt, lastBackupAt, themePreference]
│   │   ├── category.model.ts         [id, name, icon, color, isDefault, hidden, sortOrder]
│   │   ├── collection.model.ts       [coverGradient, coverIcon, visibility]
│   │   ├── place.model.ts            [customName, displayAddress, vibeTagIds, collectionIds]
│   │   ├── trip.model.ts             [startedAt, TravelMode, TripStop.visitedAt]
│   │   ├── vibe-tag.model.ts         [hidden field added in Batch A]
│   │   └── index.ts
│   ├── services/
│   │   ├── geocoding.service.ts
│   │   ├── google-maps-link.service.ts
│   │   ├── id.service.ts
│   │   ├── quote.service.ts
│   │   ├── tagline.service.ts
│   │   └── theme.service.ts
│   ├── storage/
│   │   ├── db.ts
│   │   ├── local-storage.adapter.ts
│   │   ├── storage.adapter.ts
│   │   └── storage.token.ts
│   ├── stores/
│   │   ├── app-state.store.ts        [recordChange, recordBackup, setTheme, patch]
│   │   ├── categories.store.ts       [nameAvailable, add, update, remove + recordChange]
│   │   ├── collections.store.ts      [create, updatePartial, softDelete + recordChange]
│   │   ├── filter-state.store.ts     [multi-select collections + vibes, bulk setters]
│   │   ├── places.store.ts           [updatePartial, softDelete + recordChange]
│   │   ├── trips.store.ts            [nameAvailable, findUniqueName, live-trip getters]
│   │   └── vibe-tags.store.ts        [update, nameAvailable + recordChange]
│   └── utils/
│       ├── coord-parser.ts
│       ├── geo.ts                    [haversineKm, estimateTravelTime]
│       ├── google-maps-export.ts     [motorcycle → two-wheeler]
│       └── place-maps-query.ts
├── features/
│   ├── collections/
│   │   ├── collection-detail.component.ts    [position:fixed popovers, Plan trip]
│   │   ├── collection-detail.component.html
│   │   ├── collection-detail.component.css
│   │   ├── collections-list.component.ts
│   │   ├── collections-list.component.html
│   │   └── collections-list.component.css
│   ├── home/
│   │   ├── empty-state.component.ts
│   │   ├── filter-popover.component.ts       [wf-multi-select for all dims]
│   │   ├── home.component.ts                 [catExpanded, colExpanded, vibeExpanded]
│   │   ├── home.component.html               [sidebar truncation, vibe chips, filter btn]
│   │   ├── home.component.css
│   │   ├── pin-icons.ts
│   │   └── quote-card.component.ts
│   ├── places/
│   │   ├── add-place/
│   │   │   ├── add-place.component.ts
│   │   │   ├── add-place.facade.ts
│   │   │   ├── pin-drop-celebration.component.ts
│   │   │   └── steps/
│   │   │       ├── input-step.component.ts
│   │   │       ├── confirm-location-step.component.ts
│   │   │       ├── categorize-step.component.ts   [filters hidden categories/vibes]
│   │   │       └── save-step.component.ts
│   │   ├── place-detail/
│   │   │   ├── delete-confirm.component.ts
│   │   │   ├── place-detail.component.ts
│   │   │   └── place-detail.facade.ts
│   │   └── places-list/
│   │       ├── places-list.component.ts
│   │       ├── places-list.component.html
│   │       ├── places-list.component.css
│   │       └── places-list.facade.ts
│   ├── settings/
│   │   └── settings.component.ts             [wf-category-manager, wf-vibe-tag-manager]
│   ├── trips/
│   │   ├── picker-column.component.ts        [vibes filter added]
│   │   ├── trip-card-preview.component.ts    [visited/remaining split paths]
│   │   ├── trip-plan.component.ts            [mapReady signal, avatar, motorcycle]
│   │   ├── trip-plan.component.html
│   │   ├── trip-plan.component.css           [live-controls, reset-trip-link]
│   │   ├── trip-plan.facade.ts               [resetTrip, duplicateTrip, toggleStopVisited]
│   │   ├── trip-stop-card.component.ts       [2-row layout, clickable badge, tripIsLive]
│   │   ├── trips-filter-popover.component.ts [motorcycle option]
│   │   ├── trips-so-far.component.ts         [pastExpanded, visitedCount helpers]
│   │   ├── trips-so-far.component.html       [view-all button, progress bar]
│   │   └── trips-so-far.component.css
│   └── workspace/
│       ├── workspace-shell.component.ts      [hasUnsavedChanges, backupStatusLabel]
│       ├── workspace-shell.component.html    [search button — currently disabled]
│       └── workspace-shell.component.css
├── shared/
│   ├── category-manager/
│   │   └── category-manager.component.ts    [NEW in Batch A]
│   ├── collection-picker/
│   │   └── collection-picker.component.ts
│   ├── gradient-picker/
│   │   └── gradient-picker.component.ts
│   ├── icon-picker/
│   │   └── icon-picker.component.ts
│   ├── multi-select/
│   │   └── multi-select.component.ts
│   └── vibe-tag-manager/
│       └── vibe-tag-manager.component.ts    [NEW in Batch A]
├── app.config.ts
├── app.css
├── app.html
├── app.routes.ts
└── app.ts
```

---
 
## 7. Build environment notes
 
**Compile check:** `ngc --noEmit -p tsconfig.app.json` (not `ng build`). The
project has `@angular/cdk` in `package.json` but the Windows-packaged
`node_modules` can't resolve it. Before compiling, create a stub:
 
```
node_modules/@angular/cdk/drag-drop/index.d.ts
```
 
With minimal exports for `CdkDrag`, `CdkDragHandle`, `CdkDropList`,
`CdkDragDrop`, `moveItemInArray`. Remove the stub before delivering files.
After stub removal, exactly **2 CDK errors** are expected and acceptable —
they disappear after `npm install` in the real project.

**Do not run `npm install`.** The node_modules are packaged for Windows and
cross-platform install breaks things.
 
---
 
## 8. v2 backend plan (for reference only — not v1 work)
 
A Spring Boot + PostgreSQL backend is planned. Key design points:
 
- Storage adapter swap: write `HttpStorageAdapter` implementing the same
  interface as `DexieStorageAdapter`. Swap via DI token. Angular stores
  don't change.
- Postgres + pgvector for semantic search over place embeddings.
- Spring AI for LLM features (trip summaries, place recommendations).
- Small-group collaboration model: closed groups of 5-15 people, invite links,
  group-scoped visibility, collection and trip collaborators.
- API key configuration: externalized via environment variables, feature flags
  to enable/disable LLM features per deployment.
- Sync strategy: last-write-wins conflict resolution based on `updatedAt`
  timestamps. Client pushes local state; server merges and returns resolved state.

The `WAYFINDER_COMPLETE_GUIDE.md` file in the project has detailed Spring Boot
entity examples, JPA patterns, sync endpoints, and a week-by-week learning path.
 
---
 
## 9. Communication style notes
This user prefers:
- Honest, direct answers — name tradeoffs, flag uncertainty
- **Read actual files before writing code.** Never guess at model shapes.
- Scope discussion before writing code on any non-trivial phase
- No emoji unless user uses them
- Minimal formatting in prose — avoid excessive bold and bullet nesting

This user does NOT prefer:
- Guessing at current file state and generating wrong diffs
- Repeating decisions already made
- Building speculative features that weren't asked for
- Long preambles before getting to the code

---
 
## 10. Starting prompt for the next conversation
 
Paste this after the handover doc and the project zip:
 
```
Handing over Wayfinder from a previous long conversation. The handover doc
above describes everything that's built and what comes next.
 
Two attachments:
1. wayfinder.zip — current project state (extract and inspect before writing code)
2. This handover doc
 
Phase 9 (global search) is next. The spec is in section 3 of the handover doc.
Before writing any code, read the relevant files from the zip and confirm your
understanding of what changes go where. Then propose the changes file by file
and I'll confirm before you write.

Preferred delivery format: additions-only and removals-only per file (not full
file replacements) — but only if you've read the actual current file from the
zip. If a file is too long to hold in context, ask me to paste it.
```