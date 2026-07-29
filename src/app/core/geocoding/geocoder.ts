import { InjectionToken } from '@angular/core';
 
/**
 * Provider-neutral geocoding result. This is the ONLY shape callers see —
 * nothing from any specific provider (Nominatim, Photon, Google) leaks past
 * this boundary. A new provider just has to produce this shape.
 */
export interface GeocodeResult {
  /**
   * Best POI name for the location — what we default the user's custom-name
   * field to. How it's derived is the provider's business.
   */
  name: string;
  /** Formatted "human" address — road + locality + region + country. */
  displayAddress: string;
  lat: number;
  lng: number;
  locality: string;
  region: string;
  country: string;
}

/**
 * The geocoding contract. Swap providers by binding GEOCODER to a different
 * implementation — exactly like STORAGE_ADAPTER. Callers depend on this
 * interface, never on a concrete provider.
 */
export interface Geocoder {
  /** Free-text search → best matches (typically capped, e.g. 5). */
  forward(query: string): Promise<GeocodeResult[]>;
 
  /** Coordinates → the place there, or undefined if none/failed. */
  reverse(lat: number, lng: number): Promise<GeocodeResult | undefined>;
}
 
/**
 * DI token for the active geocoder. Defaults to the Nominatim implementation
 * (provided in app.config), so today nothing changes; tomorrow you rebind this
 * to PhotonGeocoder/GoogleGeocoder in one line and every caller follows.
 */
export const GEOCODER = new InjectionToken<Geocoder>('GEOCODER');