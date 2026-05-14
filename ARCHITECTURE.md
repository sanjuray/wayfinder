# Architecture

The rules of the house. Short, opinionated, revised after the reference feature validates them.

## Folder rules

- **core/** is shared infrastructure. Models, services, stores, storage. *No UI.*
- **features/** is UI. Each feature is self-contained — a folder with its components, optional facade, and any sub-components.
- **shared-ui/** (not yet populated, but reserved) is for atoms used across *2+ features* (Modal, Chip, Toast, etc.). Anything used in only one feature stays in that feature.
- **Import direction is one-way: features → core. Never core → features. Never feature → feature.**
- If two features need the same thing, lift it into core/ or shared-ui/. No exceptions.

## Signals vs services

- **Signal stores (core/stores/)** hold *state*. Entity lists, loading flags, errors, computed selectors.
- **Services (core/services/)** hold *logic*. Stateless or singleton operations: parsing, formatting, HTTP, theme application.
- *Components* subscribe to store signals and trigger store methods. Components don't talk to services directly except via injected dependencies.
- **Facade services (features/<feature>/<feature>.facade.ts)** orchestrate multi-step flows that touch multiple stores or services. The Add-place feature has one. Most simple features won't.

A facade is @Injectable() (no providedIn) and listed in the host component's providers array, so it gets a fresh instance per modal/flow open.

## Naming

- Files: kebab-case.ts — add-place.component.ts, places.store.ts, geocoding.service.ts
- Components: PascalCase class, suffix Component — AddPlaceComponent
- Stores: PascalCase, suffix Store — PlacesStore
- Services: PascalCase, suffix Service — GeocodingService
- Signals: camelCase, **no $ suffix** — places(), not places$()
- Selector prefix: wf- — <wf-add-place>, <wf-pin-icon>

## Error handling

- All async operations live behind try/catch in store methods.
- On failure, set error state on the store. Components show the error inline, never as console.error only.
- Only *truly unexpected* errors (programmer bugs, null reference) bubble up. Network failures and validation are expected and handled in-band.
- Never swallow errors. If you can't act on it, surface it.

## Storage discipline

- **Components never touch IndexedDB or localStorage directly.** They go through stores, which go through the storage adapter.
- *Stores never know about IndexedDB.* They only know about the StorageAdapter interface.
- This is the v2-readiness rule: when v2 begins, you write SupabaseAdapter implements StorageAdapter and bind it in app.config.ts. *Zero feature code changes.*

## Theme rules

- Components style with var(--wf-*) variables only. *No hardcoded colors anywhere.*
- Theme files (src/styles/themes/*.css) define variables and *only variables*. No selectors, no rules, no @media.
- Adding a new variable means adding it to *all seven* theme files plus tokens.css. No exceptions.
- Component-specific CSS lives in the component's own .css file or styles: block.

## Testing minimums

- Every store has a *.spec.ts with at minimum: load, add, update, remove happy-path tests.
- Every service has a *.spec.ts covering its public methods.
- Every component has at minimum a smoke test (it('should create')). User-flow tests are encouraged but not required for v1.
- Facades get tested at the orchestration level: given inputs, verify the right store/service calls happen.
- **Mock the storage adapter in tests via fakeStorageAdapter()** in src/app/testing/fake-storage.ts. Never hit real IndexedDB in tests.

## The "feature" recipe

Every feature in features/ follows this shape:

features/<feature-name>/
├── <feature-name>.component.ts         (entry; standalone; loaded via routes)
├── <feature-name>.component.html
├── <feature-name>.component.css
├── <feature-name>.component.spec.ts
├── <feature-name>.facade.ts            (only if multi-step or multi-store)
├── <feature-name>.facade.spec.ts
└── <sub-components>/                   (when feature is non-trivial)

Components are *standalone*. Imports declared explicitly. *No NgModules.*

## Don't do

- Don't reach for RxJS Observables when a signal is enough. Signals are the default; Observable only for HTTP and event streams.
- Don't write your own debounce/throttle — use a signal effect with untracked() or toSignal(stream).
- Don't add a third-party UI library (Material, PrimeNG). The mockup is hand-rolled CSS; keep it that way. If you need a primitive, build it in shared-ui/.
- Don't store in localStorage directly. Storage adapter only.
- Don't put business logic in templates. Use computed signals or store methods.
- Don't console.log errors as the only response. Surface them through the store's error signal.
