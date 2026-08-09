
import { Injectable } from '@angular/core';

export interface ParsedMapsLink {
  lat?: number;
  lng?: number;
  name?: string;
  /**
   * Short links (maps.app.goo.gl/...) need a server-side redirect follow
   * because browsers can't read the Location header from a CORS-blocked redirect.
   * v1: surface error and prompt user to paste full URL.
   * v2: a Cloudflare Worker handles expansion.
   */
  needsExpansion: boolean;
  raw: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleMapsLinkService {


  /**
   * Checks if the input is a known short link format in maps.
   */
  isShortLink(input: string): boolean {
    const trimmed = input.trim();
    return /(maps\.app\.goo\.gl|g\.co\/maps)/i.test(trimmed);
  }

  /**
   * Asynchronously expands a short link to its full long URL using a public unshortening proxy.
   */
  async expandShortLink(shortUrl: string): Promise<string> {
    const trimmed = shortUrl.trim();
    // only valid for Short link maps.app.goo.gl/xxx
    if (!this.isShortLink(trimmed)) return trimmed;

    try {
      // Using a fast open-source unshorten service API to bypass browser CORS redirect blocks
      const response = await fetch(`https://unshorten.me/json/${encodeURIComponent(trimmed)}`);
      const data = await response.json();
      
      if (data && data.resolved_url && data.resolved_url !== 'http://' && data.resolved_url !== 'https://') {
        let resolved = data.resolved_url;

        // Clean Google Consent Interception page if present
        if (resolved.includes('consent.google.com')) {
          try {
            const parsedUrl = new URL(resolved);
            const continueParam = parsedUrl.searchParams.get('continue');
            if (continueParam) {
              resolved = decodeURIComponent(continueParam);
            }
          } catch (err) {
            console.warn('Failed to parse consent redirect URL parameters', err);
          }
        }

        return resolved;
      }
    } catch (e) {
      console.warn('Failed to auto-expand short link via proxy, falling back to raw', e);
    }

    return trimmed;
  }

  parse(input: string): ParsedMapsLink {
    const trimmed = input.trim();

    // Short link share.google/xxx - needs server-side expansion
    if (/(share\.google)/i.test(trimmed)) {
      return { raw: trimmed, needsExpansion: true };
    }

    // /place/Name/@lat,lng,zoom — most common Google Maps full URL
    const placeMatch = trimmed.match(/\/place\/([^/]+)\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (placeMatch) {
      return {
        name: decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')),
        lat: parseFloat(placeMatch[2]),
        lng: parseFloat(placeMatch[3]),
        needsExpansion: false,
        raw: trimmed,
      };
    }

    // ?q=lat,lng or @lat,lng
    const coordMatch = trimmed.match(/[?&@]q?=?(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
        needsExpansion: false,
        raw:trimmed,
      };
    }

    // Looked like a URL but didn't match — treat as freeform address
    return { raw: trimmed, needsExpansion: false };
  }
}