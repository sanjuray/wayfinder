
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
  parse(input: string): ParsedMapsLink {
    const trimmed = input.trim();

    // Short link maps.app.goo.gl/xxx — needs server-side expansion 
    // Short link share.google/xxx - needs server-side expansion
    if (/(maps\.app\.goo\.gl|share\.google)/i.test(trimmed)) {
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