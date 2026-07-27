# Wayfinder Backend Contract — Phase 0 + Phase 1
 
**Status:** draft for the backend build
**Scope:** Auth (Phase 0) and core CRUD + Sync (Phase 1). Circles, community,
and server-side clustering are deliberately **out of scope here** — they are
later phases and would only add noise to the first backend build.
 
The guiding rule: this contract is *derived from the existing frontend models*,
not invented alongside them. Every DTO below mirrors a TypeScript interface that
already exists in `src/app/core/models`. The `StorageAdapter` interface
(`src/app/core/storage/storage.adapter.ts`) is the method-level contract; the
HTTP endpoints map onto it one-to-one.
 
---
 
## 1. Principles
 
1. **The frontend already carries the schema.** Every entity has `id`,
   `createdAt`, `updatedAt`, and a soft-delete `deletedAt`. The ownership stubs
   (`userId`, `ownerId`, `collaboratorIds`, `visibility`) exist today. The
   backend adopts these field names verbatim — no renaming, no re-mapping.
2. **Client-generated UUIDs.** Places, collections, etc. already have stable
   `id`s created on the client. The backend treats writes as **upserts keyed by
   that id** — it never generates its own entity ids. This makes every write
   idempotent: a retried sync can't create duplicates.
3. **Soft-delete everywhere.** `DELETE` never removes a row. It stamps
   `deletedAt` and returns the tombstone. Tombstones **must** travel through the
   sync pull (see §5) even though the client filters them out of the store on
   load — that's how a delete on one device propagates to another.

4. **The JWT carries identity and plan.** `sub` = userId, `plan` =
   `freemium | circle`. Endpoints read these from the token, never from the
   request body. No per-request DB lookup for plan.
5. **Ownership is enforced server-side.** Every `/api/*` query is implicitly
   scoped to `sub` from the JWT. A user can never read or write another user's
   rows, regardless of what id they pass.
---
 
## 2. Auth (Phase 0)
 
### POST /api/auth/signup
Request:
```json
{ "email": "a@b.com", "password": "plaintext", "displayName": "Alex" }
```
Response `201`:
```json
{
  "token": "<jwt>",
   "user": { "id": "uuid", "email": "a@b.com", "displayName": "Alex", "plan": "freemium" }
}
```
- New users default to `plan: "freemium"`.
- Password is hashed server-side (bcrypt/argon2). Plaintext never stored.
- `409` if email already registered.
### POST /api/auth/login
Request:
```json
{ "email": "a@b.com", "password": "plaintext" }
```
Response `200`: same shape as signup. `401` on bad credentials.
 
### GET /api/auth/me
Auth required. Returns the current `user` object. Used by the Angular
`AuthStore` to rehydrate on refresh from a stored token.
 
### POST /api/auth/upgrade
Auth required. Moves the user to `plan: "circle"`. Issues a **new JWT** with the
updated plan claim (the old one keeps its stale claim until expiry, so a fresh
token is mandatory).
Response `200`: `{ "token": "<new-jwt>", "user": { ... "plan": "circle" } }`
 
### JWT payload
```json
{ "sub": "user-uuid", "plan": "freemium", "email": "a@b.com", "iat": 0, "exp": 0 }
```
Expiry: 24h recommended. Refresh strategy is a later concern; for Phase 0 a
re-login is acceptable.
 
---
 
## 3. Entity DTOs
 
These are the wire shapes. They are the frontend interfaces exactly. Optional
fields (`?`) are omitted from JSON when absent, not sent as null.

### Place
```
id: string (uuid, client-generated)
name: string
displayAddress?: string
lat: number
lng: number
locality: string
region: string
country: string
categoryId: string
vibeTagIds: string[]
collectionIds: string[]
status: "planned" | "visited"
isFavorite: boolean
visits: Visit[]
customName?: string
reviewText?: string
customNotes?: string
sourceUrl?: string
googleMapsQueryKey?: string
createdAt: string (ISO)
updatedAt: string (ISO)
deletedAt?: string (ISO)   -- tombstone marker
userId?: string            -- set server-side to the JWT sub on write
```

### Visit (embedded in Place)
```
id: string
date: string (ISO)
rating?: "thumbs-up" | "thumbs-down" | "meh"
note?: string
photoUrls?: string[]
createdAt: string (ISO)
```
**Note:** `visits` is an array embedded in the place. For Phase 1 it is stored
and transmitted as part of the Place (a JSONB column is the simplest fit). If
visit volume ever grows, it can be normalised into its own table later without
changing the wire DTO.

### Collection
```
id: string
name: string
coverGradient?: string
coverIcon?: string
coverImageUrl?: string
ownerId?: string            -- set server-side to JWT sub
collaboratorIds?: string[]
visibility: "private" | "shared" | "public"   -- always "private" in Phase 1
createdAt, updatedAt: string (ISO)
deletedAt?: string (ISO)
```

### Trip
```
id: string
name: string
plannedDate?: string (ISO)
stops: TripStop[]           -- order in array IS the source of truth
defaultTravelMode: "auto" | "walking" | "driving" | "motorcycle" | "transit"
notes?: string
isCompleted: boolean
startedAt?: string (ISO)
createdAt, updatedAt: string (ISO)
deletedAt?: string (ISO)
ownerId?: string
collaboratorIds?: string[]
```
TripStop:
```
id: string
placeId: string
perStopNote?: string
visitedDuringTrip: boolean
visitedAt?: string (ISO)
```

### Category
```
id: string
name: string
icon: string
color: string (hex)
isDefault: boolean
hidden: boolean
sortOrder: number
userId?: string            -- null for system defaults, JWT sub for custom
```

### VibeTag
```
id: string
name: string
isDefault: boolean
hidden?: boolean
userId?: string
```
 
---
 
## 4. CRUD endpoints (Phase 1)
 
Every endpoint below requires auth and is scoped to the JWT `sub`. The pattern
is identical across entities; Place is shown in full, the rest follow it.

### Places
```
GET    /api/places            -> Place[]      (excludes tombstones; deletedAt not set)
GET    /api/places/{id}       -> Place        (404 if not owned or not found)
PUT    /api/places/{id}       <- Place  -> Place   (upsert by id; body id must match path)
DELETE /api/places/{id}       -> Place        (soft-delete; returns the tombstone)
```
Mapping to `StorageAdapter`:
```
getPlaces()          -> GET  /api/places
getPlace(id)         -> GET  /api/places/{id}
upsertPlace(place)   -> PUT  /api/places/{id}
deletePlace(id)      -> DELETE /api/places/{id}
```

### Collections
```
GET    /api/collections
PUT    /api/collections/{id}
DELETE /api/collections/{id}
```
 
### Trips
```
GET    /api/trips
PUT    /api/trips/{id}
DELETE /api/trips/{id}
```
 
### Categories
```
GET    /api/categories
PUT    /api/categories/{id}
DELETE /api/categories/{id}
```
**System defaults:** categories/vibeTags with `isDefault: true` and no `userId`
are seeded server-side per user on signup (or treated as global read-only —
implementation choice). Either way the client sees them in the GET response.

### Vibe tags
```
GET    /api/vibetags
PUT    /api/vibetags/{id}
DELETE /api/vibetags/{id}
```
 
### App state
```
GET    /api/appstate          -> AppState
PUT    /api/appstate          <- AppState -> AppState
```
Single row per user. The `syncMode`, `authUserId`, `lastSyncAt` stub fields
become live here.
 
---
 
## 5. Sync endpoints (Phase 1 — the heart of it)

The sync layer is what lets the app keep working on IndexedDB while replicating
to the server. Two endpoints, both delta-based on `updatedAt`.
 
### POST /api/sync/push
Client sends everything changed locally since its last successful sync. The
body reuses the export envelope shape the client already produces.
```json
{
  "since": "2026-07-01T00:00:00Z",
  "data": {
    "places":      [ /* Place with updatedAt > since, INCLUDING tombstones */ ],
    "collections": [ ... ],
    "trips":       [ ... ],
    "categories":  [ ... ],
    "vibeTags":    [ ... ]
  }
}
```
Server behaviour:
- Upsert each entity by `id`, scoped to JWT `sub`.
- **Last-write-wins by `updatedAt`.** If the server's row has a newer
  `updatedAt` than the incoming one, keep the server's and report it as a
  conflict (so the client can pull it back).
- Tombstones (`deletedAt` set) are applied as soft-deletes.
Response `200`:
```json
{ "syncedAt": "2026-07-11T09:00:00Z", "conflicts": ["place-uuid-1"] }
```
 
### GET /api/sync/pull?since={iso}
Returns everything on the server changed since the given timestamp, **including
tombstones** — this is the one place tombstones must NOT be filtered out.
```json
{
  "syncedAt": "2026-07-11T09:00:00Z",
  "data": {
    "places":      [ /* changed since `since`, tombstones included */ ],
    "collections": [ ... ],
    "trips":       [ ... ],
    "categories":  [ ... ],
    "vibeTags":    [ ... ]
  }
}
```
Client merges the delta into IndexedDB, applies tombstones as local deletes,
and stores `syncedAt` as the new `since` for next time.
 
### The sync cycle
```
1. push local changes since lastSyncAt
2. pull server changes since lastSyncAt
3. merge pulled delta into IDB (tombstones -> local soft-delete)
4. store returned syncedAt as new lastSyncAt (persisted on AppState)
```
 
---
 
## 6. Bulk migration (first run)
 
For the one-time move of a user's existing IndexedDB data onto the server, the
client's existing `exportAll()` envelope is the payload.

### POST /api/migrate/import
```json
{ "wayfinder": { "schemaVersion": 1, "exportedAt": "...", "exportedBy": "...", "checksum": "..." },
  "data": { "places": [...], "collections": [...], "trips": [...], "categories": [...], "vibeTags": [...], "appState": {...} } }
```
- Idempotent: upsert by id, so re-running does nothing harmful.
- Server verifies `checksum` before importing.
- Response: `{ "imported": n, "skipped": n, "conflicts": n }` (mirrors the
  client's `ImportResult`).

---

## 7. What is intentionally NOT here
 
- **Viewport / bounded fetch endpoint** (`GET /api/places/viewport?bbox=`) —
  Phase 2. The client already filters by viewport in memory (done). The bounded
  *fetch* only matters once the dataset is server-side and too big to pull
  whole.
- **Server-side clustering** — Phase 2/3.
- **Circles, sharing, collaborators** — later phase. The `visibility`,
  `ownerId`, `collaboratorIds` fields exist in the DTOs but are always
  `private` / owner-only in Phase 1.
- **Community places table + public read path** — later phase.
- **Comments** — later phase (gated to Circle plan on write).
- **Refresh tokens / OAuth** — Phase 0 uses a single 24h JWT; refresh is a
  later hardening step.

---
 
 
## 8. Error conventions
 
```
400  malformed body / id mismatch between path and body
401  missing or invalid JWT
403  authenticated but not allowed (e.g. plan-gated endpoint — later phases)
404  entity not found OR not owned by caller (same response, no info leak)
409  signup email collision / sync checksum mismatch
```
 
Ownership failures return `404`, not `403`, so the API never reveals that a
given id exists but belongs to someone else.