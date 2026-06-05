import { InjectionToken } from '@angular/core';
import * as L_Type from 'leaflet';

export const LEAFLET = new InjectionToken<typeof L_Type>('LeafletToken', {
  providedIn: 'root',
  factory: () => {
    if (typeof window !== 'undefined' && (window as any).L) {
      return (window as any).L;
    }
    // Fallback for SSR/build environments
    return {} as typeof L_Type;
  }
});