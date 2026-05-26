import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface GeocodeResult {
  /**
   * Best POI name from Nominatim's response — priority order:
   * amenity, building, shop, tourism, leisure, road, suburb, then display_name fallback.
   * This is what we default the user's custom-name field to.
   */
  name: string;
  /**
   * Formatted "human" address — road + locality + region + country.
   * Shown beneath the custom name on the confirm-location card.
   */
  displayAddress: string;
  lat: number;
  lng: number;
  locality: string;
  region: string;
  country: string;
}

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

/**
 * Free OpenStreetMap geocoding via Nominatim.
 * Rate limit: ~1 request/second. For higher volume, paid alternatives exist
 * (MapTiler, Photon) — abstract behind this service.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
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
   * Extract the best name + address from a Nominatim response.
   *
   * For "name": prefer POI-style fields (amenity, building, shop, etc).
   * Fall back to road, then to first segment of display_name.
   *
   * For "displayAddress": construct a clean comma-separated address from
   * structured fields. Skips duplicates so "Road, Road" doesn't happen.
   */
  private adapt(r: NominatimResponse): GeocodeResult {
    const a: NominatimAddress = r.address ?? {};

    // POI name — first non-empty wins
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

    // Build a clean display address from structured fields
    const parts = [
      a.road ?? a.pedestrian,
      a.neighbourhood ?? a.suburb,
      a.city ?? a.town ?? a.village,
      a.state,
      a.country,
    ];

    // Dedupe (POI name often duplicates road) and remove empties
    const seen = new Set<string>();
    if (name) seen.add(name.toLowerCase());
    const cleanParts = parts.filter((p) => {
      if (!p) return false;
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const displayAddress = cleanParts.join(', ') || r.display_name;

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
