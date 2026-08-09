import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
 
import { Geocoder, GeocodeResult } from './geocoder';
 
/**
 * Nominatim (OpenStreetMap) implementation of the Geocoder contract.
 * Free; rate-limited to ~1 request/second. For higher volume, a paid provider
 * (Photon, MapTiler, Google) can implement Geocoder and be swapped in via the
 * GEOCODER token — no caller changes.
 *
 * All Nominatim-specific request/response shapes are private to this file;
 * nothing beyond GeocodeResult crosses the boundary.
 */
interface NominatimAddress {
  amenity?: string;
  building?: string;
  shop?: string;
  tourism?: string;
  leisure?: string;
  office?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
}
 
interface NominatimResponse {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
  type?: string;
  class?: string;
}

@Injectable({ providedIn: 'root' })
export class NominatimGeocoder implements Geocoder {
  private http = inject(HttpClient);
  private readonly base = 'https://nominatim.openstreetmap.org';
 
  async forward(query: string): Promise<GeocodeResult[]> {
    const url = `${this.base}/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
    const resp = await firstValueFrom(this.http.get<NominatimResponse[]>(url));
    return resp.map((r) => this.adapt(r));
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | undefined> {
    const url = `${this.base}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    try {
      const r = await firstValueFrom(this.http.get<NominatimResponse>(url));
      return this.adapt(r);
    } catch {
      return undefined;
    }
  }
 
  /**
   * Map a Nominatim response into the neutral GeocodeResult.
   * name: prefer POI fields (amenity, building, shop, …), fall back to road,
   * then to the first segment of display_name.
   * displayAddress: clean comma-separated address from structured fields,
   * de-duplicated so "Road, Road" doesn't happen.
   */
  private adapt(r: NominatimResponse): GeocodeResult {
    const a: NominatimAddress = r.address ?? {};
 
    const name =
      a.amenity ??
      a.building ??
      a.shop ??
      a.tourism ??
      a.leisure ??
      a.office ??
      a.road ??
      a.pedestrian ??
      a.neighbourhood ??
      a.suburb ??
      this.firstSegment(r.display_name) ??
      'Unnamed place';

    const parts = [
      a.road ?? a.pedestrian,
      a.neighbourhood ?? a.suburb,
      a.city ?? a.town ?? a.village,
      a.state,
      a.country,
    ];
 
    const seen = new Set<string>();
    if (name) seen.add(name.toLowerCase());
    const cleanParts = parts.filter((p) => {
      if (!p) return false;
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const displayAddress = r.display_name;

    return {
      name,
      displayAddress,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      locality: a.city ?? a.town ?? a.village ?? '',
      region: a.state ?? '',
      country: a.country ?? '',
    };
  }
 
  private firstSegment(displayName: string): string | undefined {
    return displayName.split(',')[0]?.trim() || undefined;
  }
}
