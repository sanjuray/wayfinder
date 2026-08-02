# Wayfinder — Developer Onboarding Guide

> **Who this is for:** a developer joining Wayfinder who needs to get productive
> fast. It covers the mental model, the architecture and the reasoning behind it,
> the current backend + sync layer, every API endpoint, and — honestly — the
> stubs, seams, and known gaps you'll trip over.
>
> **Read alongside:** `ARCHITECTURE.md` (house rules), `DECISIONS.md` (why each
> choice, with alternatives), `Frontend-Backend-Contract.md` (the original
> design contract — note it predates the built backend; see
> [§9 Contract drift](#9-contract-drift) for where reality diverges).
 
---

## Table of contents

1. [The one-paragraph mental model](#1-the-one-paragraph-mental-model)
2. [Stack & versions](#2-stack--versions)
3. [Running it locally](#3-running-it-locally)
4. [Frontend architecture](#4-frontend-architecture)
5. [The storage-adapter seam (the keystone)](#5-the-storage-adapter-seam-the-keystone)
6. [State: stores, services, facades](#6-state-stores-services-facades)
7. [Backend architecture](#7-backend-architecture)
8. [The sync protocol](#8-the-sync-protocol)
9. [Contract drift (design vs. built)](#9-contract-drift)
10. [API reference — every endpoint](#10-api-reference)
11. [Stubs, seams & future sights](#11-stubs-seams--future-sights)
12. [Gotchas the last dev learned the hard way](#12-gotchas)

---

## 1. The one-paragraph mental model

Wayfinder is a **local-first** places-and-trips app. The frontend (Angular 21,
`@ngrx/signals`) reads and writes everything through a single `StorageAdapter`
interface. In v1 that adapter is IndexedDB (Dexie); the app works fully offline
with no account. A Spring Boot backend adds **optional** cross-device sync:
signed-in users push/pull deltas to Postgres, guests stay purely local and move
data via JSON export/import. The whole architecture is built so that "add a
backend" was additive — the feature code never learned the server exists; only
the sync layer and auth store did.
 
---

## 2. Stack & versions

**Frontend**

| Concern | Choice | Notes |
|---|---|---|
| Framework | Angular 21 (standalone, zoneless) | No NgModules anywhere |
| State | `@ngrx/signals` 21 | signalStore; **no** classic ngrx/store |
| Local DB | Dexie 4 (IndexedDB) | Behind the storage adapter |
| Map | Leaflet 1.9 + OpenStreetMap | `leaflet.markercluster` for clusters |
| Geocoding | Nominatim (OSM) | Behind a `GEOCODER` token seam |
| Icons | Tabler (`@iconify-json/tabler`) | `ti-*` classes |
| Styling | Plain CSS + `--wf-*` tokens | 7 themes, no Tailwind/SCSS |
| Tests | Vitest | Angular 21 default |
| Fonts | Fraunces / Manrope / Kalam | display / body / handwrite |

**Backend**

| Concern | Choice | Notes |
|---|---|---|
| Framework | Spring Boot 3 (Java 21) | |
| DB | PostgreSQL | JSONB for embedded arrays (visits, stops) |
| ORM | Spring Data JPA / Hibernate | `@JdbcTypeCode(SqlTypes.JSON)` for JSONB |
| Auth | JWT in an **httpOnly cookie** | Not a bearer token in a header — see §7 |
| Object storage | S3 seam (stubbed) | For v2 image uploads |

> ⚠️ **Version note:** `RUNNING.md` and `DECISIONS.md` say "Angular 19" and
> "Karma" in places — those are stale. `package.json` is the source of truth:
> Angular **21**, Vitest. Node **20.11+** required.
 
---

## 3. Running it locally

**Frontend**
```bash
npm install
npm start            # http://localhost:4200, hot reload
npm test             # Vitest
npm run build        # dist/wayfinder/
```

**Backend**
```bash
docker compose up -d          # Postgres
./mvnw spring-boot:run        # http://localhost:8080
```

The frontend points at `http://localhost:8080/api` via
`src/environments/environment.ts`. Guest mode needs no backend at all — you can
run the whole app with just `npm start`.

**Backend env knobs** (all have dev defaults in `application.properties`):
`JWT_SECRET`, `JWT_TTL_HOURS` (default 24), `PORT` (8080), plus the `S3_*`
storage vars (unused until image upload lands).

> **DB schema:** the backend relies on Hibernate `ddl-auto`. After pulling
> changes that add columns (e.g. the sync entities), run with `ddl-auto=update`
> or drop-recreate the dev tables. There is **no Flyway yet** — that's a known
> gap (§11).
 
---

## 4. Frontend architecture

The house rules live in `ARCHITECTURE.md`; the essentials:

```
src/app/
├── core/                     shared infra — NEVER imports from features/
│   ├── models/               domain types (the schema contract)
│   ├── storage/              StorageAdapter interface + Dexie impl + token
│   ├── stores/               @ngrx/signals stores, one per entity
│   ├── services/             stateless logic (geocode, theme, sync, search…)
│   ├── geocoding/            GEOCODER token + Nominatim impl (a seam)
│   ├── guards/               session.guard
│   ├── interceptors/         credentials.interceptor (sends the cookie)
│   └── seed/                 default categories + vibe tags
└── features/                 UI — one folder per screen
    ├── home/                 the map
    ├── places/               add-place flow, place-detail, places-list
    ├── collections/          list + detail
    ├── trips/                trips-so-far + trip-plan
    ├── settings/
    └── help/                 the how-it-works guide
```

**The one rule that matters most:** imports flow **features → core, never the
reverse, never feature → feature.** If two features need the same thing, it goes
in `core/`. This keeps the dependency graph acyclic and is what makes the
storage swap safe.

**Signals vs services vs facades:**
- **Stores** (`core/stores/`) hold *state* — entity lists, `loading`, `error`,
  computed selectors. `providedIn: 'root'`.
- **Services** (`core/services/`) hold *logic* — stateless or singleton
  operations (geocoding, HTTP sync, theme application).
- **Facades** (`features/<f>/<f>.facade.ts`) orchestrate multi-step, multi-store
  flows. They're `@Injectable()` (no `providedIn`) and listed in the host
  component's `providers: []` so each modal/flow gets a fresh instance. There are
  five: add-place, place-detail, places-list, trip-plan, collection-edit.

---

## 5. The storage-adapter seam (the keystone)

This is the single most important design decision to understand. **Everything**
persistent goes through one interface:

```ts
// core/storage/storage.adapter.ts
export interface StorageAdapter {
  getPlaces(): Promise<Place[]>;
  upsertPlace(place: Place): Promise<void>;
  deletePlace(id: string): Promise<void>;
  // …same 3-method shape for collections, trips, categories, vibeTags
  getAppState(): Promise<AppState | undefined>;
  setAppState(s: AppState): Promise<void>;
  exportAll(): Promise<WayfinderEnvelope>;
  importAll(envelope: unknown, mode: ImportMode): Promise<ImportResult>;
  clear(): Promise<void>;
}
```

- **Components never touch IndexedDB.** They call stores; stores call the
  adapter; the adapter is the only thing that knows about Dexie.
- It's bound **once**, in `app.config.ts`:
```ts
  { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }
```
- **Why it matters:** this is the v2-readiness lever. When cloud storage becomes
  the primary store, you write a new adapter and change that one line — zero
  feature-code changes. (See `DECISIONS.md §2`.)
- **In tests:** inject `fakeStorageAdapter()` from `src/app/testing/fake-storage.ts`
  — an in-memory implementation. Never hit real IndexedDB in a test.

> **Note on sync vs. the adapter:** sync did **not** replace the adapter. The app
> still writes to IndexedDB through `LocalStorageAdapter`; `SyncService` reads
> from the adapter and replicates to the server separately. The originally
> planned `HttpAdapter` (places → server, rest → IDB) was **not** built — sync
> is a parallel layer, not an adapter swap. See §11.
 
---

## 6. State: stores, services, facades

**Entity stores** (all follow the same shape):
`places`, `collections`, `trips`, `categories`, `vibe-tags`, plus
`app-state`, `auth`, and two UI-state stores (`filter-state`, and the
`search-state` service).

Every entity store exposes: `load()`, `add()`, `update()`/`updatePartial()`,
`remove()`/`softDelete()`, `getById()`, computed selectors, and — added for sync
— `applyRemote(incoming[])`. Mutations call `AppStateStore.recordChange()` to
drive the "unsaved changes" indicator; `applyRemote()` deliberately does **not**
(server data isn't a user change).

**Key services:**

| Service | Job |
|---|---|
| `sync.service` | The push→pull cycle + 5-min auto-sync (§8) |
| `backup.service` | JSON export (shared by Settings + topbar) |
| `theme.service` | Applies `<html data-theme>` |
| `geocoding.service` | Address → coords (via the `GEOCODER` seam) |
| `google-maps-link.service` | Parses/builds Google Maps URL variants |
| `search.service` | Fuzzy search across places/collections/trips |
| `guest-mode.service` | Tracks guest opt-in (sessionStorage) |
| `id.service` | UUID generation (client-side ids) |
| `tagline` / `quote` | The flavour text + easter-egg quote bank |

**Soft-delete everywhere:** `remove()` on every synced entity stamps `deletedAt`
+ `updatedAt` and keeps the row in IndexedDB (a tombstone). The store filters
  tombstones out of `entities` at load time. This is non-negotiable for sync — a
  hard delete on device A would just get re-created from device B. (Categories and
  vibe-tags were converted from hard-delete to soft-delete when sync landed.)

---

## 7. Backend architecture

Package-per-feature under `com.wayfinder`:

```
com.wayfinder/
├── auth/          User, AuthController/Service, JWT, handle logic, dto/
├── config/        SecurityConfig, JwtAuthFilter, JwtService, cookie service
├── common/        ApiError, ApiException, GlobalExceptionHandler
├── places/        Place slice — the template every other slice copies
├── collections/   \
├── trips/          |  each: Entity, Dto, Mapper, Repository, Service, Controller
├── categories/     |
├── vibetags/       |
├── appstate/      /  (one row per user; userId is the PK)
├── sync/          SyncController + SyncService + dto/SyncDtos
├── billing/       PaymentProvider seam (placeholder impl active)
└── storage/       S3 file-storage seam (for v2 uploads)
```

**Every entity slice is the same 6 files** modelled on `places/`: `Entity`,
`Dto` (a record, the wire shape), `Mapper` (entity↔dto), `Repository` (Spring
Data), `Service` (upsert with last-write-wins + soft-delete + `changedSince`),
`Controller` (GET list / GET by id / PUT upsert / DELETE soft-delete). If you're
adding an entity, copy `places/` and rename.

**Auth model — read this carefully:**
- The JWT lives in an **httpOnly cookie**, *not* a bearer token in a header. The
  auth response body contains only `{ user }` — never the token (putting it in
  the body would defeat httpOnly).
- `JwtAuthFilter` reads the cookie, validates it, and populates an `AuthUser`
  record `(id, email, plan)` reconstructed from the token claims — **no
  per-request DB lookup** for identity or plan.
- Controllers get the caller via `@AuthenticationPrincipal AuthUser user` and
  scope every query to `user.id()`. A user can never touch another user's rows.
- The frontend's `credentials.interceptor` sets `withCredentials: true` so the
  cookie rides along; the `AuthStore` holds **no token** (it can't read the
  httpOnly cookie) — "am I logged in?" is answered by whether `GET /auth/me`
  

**Ownership enforcement:** every `/api/*` route (except the auth public ones) is
`authenticated()` in `SecurityConfig` and implicitly scoped to the JWT `sub`.
Not-found and not-owned both return **404** — the API never reveals that an id
exists but belongs to someone else.

--- 

## 8. The sync protocol

Two endpoints, delta-based on `updatedAt`. The frontend `SyncService` owns the
cycle; the backend `SyncService` applies it.

**The cycle** (frontend `syncNow()`):
```
1. Read ALL local entities from the adapter (incl. tombstones).
2. Filter to updatedAt > lastSyncedAt  (or send everything on first sync).
3. POST /api/sync/push   → server upserts (last-write-wins), returns conflicts.
4. GET  /api/sync/pull?since=…  → server returns everything newer, tombstones incl.
5. applyRemote() each entity into the store + IndexedDB.
6. AppStateStore.recordSync()  → stamp lastSyncedAt.
```

**Conflict handling:** last-write-wins by `updatedAt`. If the server's row is
newer, it keeps its copy and returns the id in `conflicts[]`. The client doesn't
special-case those — the pull in step 4 already brings the winning version back,
and `applyRemote()`'s own `updatedAt` comparison keeps whichever is newer.

**App state is special:** it's a single object, not a list, and the client
always wins on push (it's preferences, not collaborative data). `appStateConflict`
in the push response is always `false` today but exists as a hook.

**Auto-sync:** a constructor-level `effect()` in `SyncService` watches
`AuthStore.isLoggedIn()`. On becoming logged-in it fires an immediate sync +
`refreshProfile()`, then a 5-minute interval doing both. On logout it clears the
interval. Guests never sync (`syncNow()` no-ops if not logged in). The manual
"Sync now" button in the topbar is the same call.

**Why sync reads from the adapter, not the store:** stores filter out
tombstones, but tombstones *must* travel to the server (that's how deletes
propagate). Reading straight from the adapter includes them.
 
---

## 9. Contract drift

`Frontend-Backend-Contract.md` is the *design* contract, written before the
backend was built. The built backend diverges in these ways — **trust this
section over that doc where they conflict:**

| Topic | Contract said | Actually built |
|---|---|---|
| Vibe-tags path | `/api/vibetags` | **`/api/vibe-tags`** |
| App-state path | `/api/appstate` | **`/api/app-state`** |
| Auth token | JWT in response body | **httpOnly cookie**, body has `{ user }` only |
| Push response | `{ syncedAt, conflicts }` | adds **`appStateConflict`** |
| App state in sync | not in sync `data` | **included** in `SyncData` (null = unchanged) |
| Categories/VibeTags | no timestamps | **`createdAt`/`updatedAt`/`deletedAt` added** (needed for sync LWW) |
| `POST /api/migrate/import` | specified | **not built** (use export/import + sync instead) |
| Bulk viewport fetch | Phase 2 | still not built (client filters in memory) |
| Auth extras | signup/login/me/upgrade | also built: **logout, cancel, change-password, handle-available, PATCH /me** |

The category/vibe-tag timestamp addition was a real fix: sync's last-write-wins
needs `updatedAt` on every entity, and those two models originally lacked it.
Deletes on them were also converted from hard to soft.
 
---

## 10. API reference

Base URL: `http://localhost:8080/api`. All routes require the auth cookie except
`POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, and `OPTIONS *`.
All timestamps are ISO 8601 strings. Ownership is implicit (JWT `sub`); pass no
userId — the server sets it.

### Auth

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| POST | `/auth/signup` | `{ email, password, displayName? }` | `201 { user }` + Set-Cookie | Password policy: ≥8 chars, upper+lower+digit+special. `409` on email collision |
| POST | `/auth/login` | `{ email, password }` | `200 { user }` + Set-Cookie | `401` on bad creds |
| POST | `/auth/logout` | — | `200`, clears cookie | Public |
| GET | `/auth/me` | — | `{ id, email, handle, displayName, plan }` | Rehydrates `AuthStore` |
| PATCH | `/auth/me` | `{ displayName?, handle? }` | updated user | Email not editable |
| GET | `/auth/handle-available?handle=` | — | `{ handle, available }` | Auth-gated (no public enumeration) |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | `204` | Verifies current first |
| POST | `/auth/upgrade` | — | `{ user }` (plan=circle) + new cookie | Re-issues JWT with new plan claim |
| POST | `/auth/cancel` | — | `{ user }` (plan=freemium) + new cookie | Routes through the payment seam |

**User shape:** `{ id, email, handle, displayName, plan }` where `plan` is
`"freemium" | "circle"`.

**JWT claims:** `{ sub: userId, plan, email, iat, exp }`. TTL 24h (configurable).

### Entity CRUD

Identical shape for **places, collections, trips, categories, vibe-tags**. Paths:
`/api/places`, `/api/collections`, `/api/trips`, `/api/categories`,
`/api/vibe-tags`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/{entity}` | — | `Entity[]` (excludes tombstones) |
| GET | `/api/{entity}/{id}` | — | `Entity` (`404` if not found/owned) |
| PUT | `/api/{entity}/{id}` | `Entity` | upserted `Entity` (body id must match path; `400` if not) |
| DELETE | `/api/{entity}/{id}` | — | the tombstone (soft-delete: stamps `deletedAt`) |

PUT is an **upsert keyed by the client-generated id** and applies
last-write-wins: if the stored row's `updatedAt` is newer than the incoming
one, the server keeps its copy and returns it unchanged.

### App state

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/app-state?lastChangeAt=` | — | `AppState` (server default on first call) |
| PUT | `/api/app-state` | `AppState` | stored `AppState` |

One row per user (userId is the PK). No `/{id}`, no DELETE. `lastChangeAt` is a
client-owned dirty-flag value the server round-trips but never interprets.
`updatedAt` is server-stamped so sync's changed-since works.

### Sync

**POST `/api/sync/push`**
```json
{
  "since": "2026-07-01T00:00:00Z",        // null on first sync
  "data": {
    "places":      [ /* updatedAt > since, tombstones INCLUDED */ ],
    "collections": [ … ], "trips": [ … ],
   "categories":  [ … ], "vibeTags": [ … ],
    "appState":    { … } | null            // null = unchanged
  }
}
```
→
```json
{
  "syncedAt": "2026-07-11T09:00:00Z",
  "conflicts": ["place-uuid-1"],           // server kept its newer copy
  "appStateConflict": false
}
```

**GET `/api/sync/pull?since={iso}`** (omit `since` for a full pull)
```json
{
  "syncedAt": "2026-07-11T09:00:00Z",
  "data": {
    "places": [ /* changed since `since`, tombstones INCLUDED */ ],
    "collections": [ … ], "trips": [ … ],
    "categories": [ … ], "vibeTags": [ … ],
    "appState": { … } | null
  }
}
```

### Error conventions

| Code | Meaning |
|---|---|
| `400` | Malformed body / path-body id mismatch |
| `401` | Missing/invalid auth cookie |
| `403` | Authenticated but not allowed (plan-gated — later phases) |
| `404` | Not found **or** not owned (same response — no info leak) |
| `409` | Signup email collision / id conflict |

Error body: `{ error, code }` (see `common/ApiError`).

### Entity wire shapes

The DTOs mirror the frontend `core/models/*` interfaces exactly. Full field
lists are in `Frontend-Backend-Contract.md §3` (accurate for fields, but note
the timestamp additions to Category/VibeTag from §9). Embedded arrays
(`Place.visits`, `Trip.stops`) travel inline as JSONB.
 
---

## 11. Stubs, seams & future sights

Things that are deliberately incomplete, and the seam left for each:

**Frontend**
- **`HttpAdapter` — not built.** `app.config.ts` still binds `LocalStorageAdapter`.
  The original plan (places → server, rest → IDB via an adapter swap) was
  superseded by the parallel `SyncService` approach. If you ever want the server
  to be the *primary* store, this is the seam: implement `StorageAdapter`
  against the API and swap the one binding.
- **Backup infrastructure vs. sync.** For guests, JSON export/import is the only
  cross-device path (kept intentionally). For signed-in users it's redundant
  with sync but harmless. `autoBackupFrequency`/`lastBackupAt` on `AppState`
  exist for the guest story.
- **Tile provider is hardcoded.** OSM tiles in `home.component.ts`; the intended
  "Settings → Advanced → map provider" picker isn't built.
- **Default-category duplication risk.** Defaults are client-seeded with
  generated ids. Two devices seed different ids for the same logical category →
  duplicates on sync. Fix path discussed but not shipped: deterministic ids for
  defaults (see §12).

**Backend**
- **No Flyway.** Schema is Hibernate `ddl-auto`. Migrations are a known gap —
  add Flyway before any real deploy (esp. for the handle unique constraint).
- **Payment is a placeholder.** `billing/PlaceholderPaymentProvider` "succeeds"
  immediately so upgrade→Circle works end-to-end in dev. Bind a
  `StripePaymentProvider`/`RazorpayPaymentProvider` to go live — no caller
  changes (`PaymentProvider` is the seam; there's a `reference/` sketch).
- **S3 file storage is stubbed.** `storage/` has the seam + config for v2 image
  uploads (`coverImageUrl`, `Visit.photoUrls`); nothing writes to it yet.
- **v2 collaboration fields are dormant.** `ownerId`, `collaboratorIds`,
  `visibility` exist on Collection/Trip DTOs and columns but are always
  owner-only/`private`. Round-tripped so they're not dropped when collaboration
  lands.
- **JWT refresh.** Single 24h token, no refresh flow — re-login on expiry. A
  later hardening step.
- **Not built (later phases):** viewport/bounded fetch, server-side clustering,
  community places, comments (Circle-gated), OAuth/magic-links.

---

## 12. Gotchas

Hard-won lessons — worth internalising before you edit:

- **Work from the *current* uploaded file, not the base zip.** Several files
  (e.g. `workspace-shell.css`) grew well past their baseline; the base snapshot
  is stale for anything edited across sessions. Edit → copy to output → grep the
  output to confirm → then trust it.
- **`updatedAt` must exist on every synced entity.** Category/VibeTag originally
  lacked it and it silently broke the sync changed-since filter (`undefined >
  since` is always false → those entities never pushed). If you add an entity to
  sync, it needs `createdAt`/`updatedAt`/`deletedAt`.
- **Never `display:none` an interactive control** for "hidden" styling — it drops
  from the tab order. Use the clip-rect visually-hidden technique (see the
  settings file-input and the toggle switch).
- **Sync reads from the adapter, stores hide tombstones.** If you make sync read
  `store.entities()` instead of `storage.get*()`, deletes stop propagating.
- **Plan changes need `refreshProfile()`.** `checkSession()` only runs at
  bootstrap; a plan change elsewhere won't reflect until `/auth/me` is re-fetched.
  Settings mount + the sync interval both call `refreshProfile()` for this.
- **DB columns are additive but not automatic.** New non-null columns need
  `ddl-auto=update` or a drop-recreate on your dev DB, since there's no Flyway.
- **`verify by inspection` is the rule.** The previous developer could not run
  the build in their environment either — `ng serve` / `./mvnw` on your machine
  is the final proof. Type errors and import paths are the usual surprises.

---

*Keep this doc honest. When you close a gap in §11 or resolve a drift in §9,
update the row rather than deleting it — the history of "why is it like this?"
is worth more than a clean-looking doc.*
