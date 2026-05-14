import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddPlaceFacade } from './add-place.facade';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { GoogleMapsLinkService } from '../../../core/services/google-maps-link.service';
import { IdService } from '../../../core/services/id.service';
import { STORAGE_ADAPTER } from '../../../core/storage/storage.token';
import { fakeStorageAdapter } from '../../../testing/fake-storage';

describe('AddPlaceFacade', () => {
  let facade: AddPlaceFacade;
  let geocoding: { forward: ReturnType<typeof vi.fn>; reverse: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    geocoding = {
      forward: vi.fn(),
      reverse: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AddPlaceFacade,
        { provide: GeocodingService, useValue: geocoding },
        GoogleMapsLinkService,
        IdService,
        { provide: STORAGE_ADAPTER, useValue: fakeStorageAdapter() },
      ],
    });

    facade = TestBed.inject(AddPlaceFacade);
  });

  it('starts at step 1 with empty draft', () => {
    expect(facade.step()).toBe(1);
    expect(facade.draft()).toBeNull();
  });

  it('blocks Continue on step 1 with empty input', () => {
    expect(facade.canContinueStep1()).toBe(false);
    facade.inputText.set('   ');
    expect(facade.canContinueStep1()).toBe(false);
    facade.inputText.set('Café Kitsuné');
    expect(facade.canContinueStep1()).toBe(true);
  });

  it('resolves an address and advances to step 2', async () => {
    geocoding.forward.mockResolvedValue([
      {
        name: 'Café Kitsuné',
        lat: 35.66,
        lng: 139.71,
        locality: 'Tokyo',
        region: '',
        country: 'Japan',
      },
    ]);
    facade.inputText.set('Café Kitsuné Aoyama');
    await facade.resolveInput();
    expect(facade.step()).toBe(2);
    expect(facade.draft()?.locality).toBe('Tokyo');
  });

  it('surfaces an error when geocoder returns nothing', async () => {
    geocoding.forward.mockResolvedValue([]);
    facade.inputText.set('asdfgh nowhere');
    await facade.resolveInput();
    expect(facade.error()).toContain("Couldn't find");
    expect(facade.step()).toBe(1);
  });

  it('toggles vibe tags', () => {
    facade.toggleVibeTag('tag-1');
    expect(facade.vibeTagIds()).toEqual(['tag-1']);
    facade.toggleVibeTag('tag-2');
    expect(facade.vibeTagIds()).toEqual(['tag-1', 'tag-2']);
    facade.toggleVibeTag('tag-1');
    expect(facade.vibeTagIds()).toEqual(['tag-2']);
  });

  it('save returns null when category is missing', async () => {
    const result = await facade.save();
    expect(result).toBeNull();
  });

  it('reset clears all state', () => {
    facade.inputText.set('something');
    facade.step.set(3);
    facade.categoryId.set('cat-1');
    facade.reset();
    expect(facade.step()).toBe(1);
    expect(facade.inputText()).toBe('');
    expect(facade.categoryId()).toBeNull();
  });
});