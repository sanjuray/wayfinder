import { Injectable } from '@angular/core';
import type { ThemeName } from '../models';

/**
 * Applies the active theme by setting <html data-theme="...">.
 * The CSS in styles/themes/*.css picks up the attribute and re-skins everything.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  apply(theme: ThemeName): void {
    document.documentElement.dataset['theme'] = theme;
    document.body.dataset['theme'] = theme;
  }
}