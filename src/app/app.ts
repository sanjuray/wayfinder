import { Component, effect, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/services/theme.service';
import { TaglineService } from './core/services/tagline.service';
import { AppStateStore } from './core/stores/app-state.store';
import { CategoriesStore } from './core/stores/categories.store';
import { VibeTagsStore } from './core/stores/vibe-tags.store';
import { CollectionsStore } from './core/stores/collections.store';
import { PlacesStore } from './core/stores/places.store';
import { TripsStore } from './core/stores/trips.store';

@Component({
  selector: 'wf-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private themeService = inject(ThemeService);
  private taglineService = inject(TaglineService);
  private appState = inject(AppStateStore);
  private categories = inject(CategoriesStore);
  private vibeTags = inject(VibeTagsStore);
  private collections = inject(CollectionsStore);
  private places = inject(PlacesStore);
  private trips = inject(TripsStore);

  constructor(){
    effect(() =>{
      this.themeService.apply(this.appState.themePreference());
    })
  }

  async ngOnInit(): Promise<void> {
    // Load app state first (theme preference lives there)
    await this.appState.load();
    // this.themeService.apply(this.appState.themePreference());
    this.taglineService.startShuffle();

    // Then load all entity stores in parallel
    await Promise.all([
      this.categories.load(),
      this.vibeTags.load(),
      this.collections.load(),
      this.places.load(),
      this.trips.load(),
    ]);
  }
}