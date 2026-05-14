import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
  locality: string;
  region: string;
  country: string;
}

interface NominatimResponse {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
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

  private adapt(r: NominatimResponse): GeocodeResult {
    const a = r.address ?? {};
    return {
      name: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      locality: a.city ?? a.town ?? a.village ?? '',
      region: a.state ?? '',
      country: a.country ?? '',
    };
  }
}