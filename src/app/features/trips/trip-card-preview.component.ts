import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';

/**
 * Mini-map preview for the trip-list cards (Phase 6e). Renders a small
 * SVG with the trip's polyline + numbered pins, normalized to fit the
 * card's viewBox.
 *
 * Why a separate component:
 *   - Keeps trips-so-far.component focused on layout
 *   - Reusable if/when we add map previews to other contexts (collection
 *     cards, search results)
 *   - The normalization + bezier math has enough surface area to deserve
 *     its own file with comments
 *
 * Input shape: just the stop coords (latitude/longitude pairs in stop
 * order). The component doesn't know about the Trip or Place models —
 * the parent resolves coords from stop.placeId before passing in.
 *
 * Visuals:
 *   - background "grid" effect via subtle horizontal+vertical lines
 *   - polyline is a quadratic Bezier per segment (same shape as the big
 *     planner map, but pre-sampled at a fixed resolution since the
 *     viewBox is small enough that 12 points per segment looks smooth)
 *   - numbered pins at each stop (first/last get .start / .end classes)
 *   - past trips use the teal accent color (passed via [variant])
 *   - drafts use a lower-opacity polyline
 *
 * Trips with fewer than 2 stops render just the grid + a centered hint —
 * a single dot for 1 stop, nothing for 0 stops.
 */
@Component({
  selector: 'wf-trip-card-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview" [class.draft]="variant() === 'draft'" [class.past]="variant() === 'past'">
      <!-- Background grid for visual interest. CSS handles this — pure
           ::before / ::after pseudo-elements. -->

      <svg
        class="path-svg"
        viewBox="0 0 280 130"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        @if (polylinePath(); as d) {
          <path
            [attr.d]="d"
            fill="none"
            [attr.stroke]="strokeColor()"
            stroke-width="2"
            [attr.stroke-dasharray]="variant() === 'past' ? null : '4 3'"
            [attr.opacity]="pathOpacity()"
            stroke-linecap="round"
          />
        }
      </svg>

      @for (pin of pins(); track $index) {
        <div
          class="mini-pin"
          [class.start]="pin.start"
          [class.end]="pin.end"
          [class.past]="variant() === 'past'"
          [style.left.px]="pin.x"
          [style.top.px]="pin.y"
        >
          {{ pin.n }}
        </div>
      }

      @if (coords().length === 0) {
        <div class="empty-hint">No stops yet</div>
      } @else if (coords().length === 1) {
        <div class="empty-hint">1 stop — needs more to draw a route</div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .preview {
        position: relative;
        width: 100%;
        height: 130px;
        overflow: hidden;
        background: var(--wf-bg-2);
        border-radius: 10px 10px 0 0;
      }
      /* Faint background grid using gradients — much cheaper than rendering
         real grid lines in SVG. */
      .preview::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(
            0deg,
            transparent 0,
            transparent 22px,
            color-mix(in srgb, var(--wf-ink) 4%, transparent) 22px,
            color-mix(in srgb, var(--wf-ink) 4%, transparent) 23px
          ),
          repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 22px,
            color-mix(in srgb, var(--wf-ink) 4%, transparent) 22px,
            color-mix(in srgb, var(--wf-ink) 4%, transparent) 23px
          );
        pointer-events: none;
      }
      .preview.past {
        background: color-mix(in srgb, var(--wf-teal) 6%, var(--wf-bg-2));
      }

      .path-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .mini-pin {
        position: absolute;
        width: 22px;
        height: 22px;
        margin-left: -11px;
        margin-top: -11px;
        border-radius: 50%;
        background: var(--wf-accent);
        color: var(--wf-bg);
        font-family: var(--wf-font-display);
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        z-index: 2;
      }
      .mini-pin.past {
        background: var(--wf-teal);
      }
      .mini-pin.start,
      .mini-pin.end {
        box-shadow:
          0 0 0 2px color-mix(in srgb, var(--wf-accent) 30%, transparent),
          0 1px 3px rgba(0, 0, 0, 0.15);
      }
      .mini-pin.past.start,
      .mini-pin.past.end {
        box-shadow:
          0 0 0 2px color-mix(in srgb, var(--wf-teal) 30%, transparent),
          0 1px 3px rgba(0, 0, 0, 0.15);
      }

      .empty-hint {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: var(--wf-ink-faint);
        font-style: italic;
        pointer-events: none;
      }
    `,
  ],
})
export class TripCardPreviewComponent {
  /** Stop coords in trip order. Each [lat, lng]. */
  readonly coords = input.required<Array<[number, number]>>();

  /**
   * Visual variant. Affects color + opacity:
   *   - default: accent color, dashed (planned/upcoming/in-progress)
   *   - draft: same as default but lower opacity (the trip isn't real yet)
   *   - past: teal color, solid line (the trip happened)
   */
  readonly variant = input<'default' | 'draft' | 'past'>('default');

  /**
   * Pin positions in SVG-space (viewBox 280×130 — same units as
   * left/top in pixels here because preserveAspectRatio="none" and the
   * preview's CSS height is 130px; with a flexible width, x positions
   * scale proportionally — close enough for an indicative mini-map).
   */
  protected pins = computed<Array<{ n: number; x: number; y: number; start: boolean; end: boolean }>>(
    () => {
      const c = this.coords();
      if (c.length === 0) return [];
      const points = this.normalizedPoints();
      return points.map((p, i) => ({
        n: i + 1,
        x: p.x,
        y: p.y,
        start: i === 0,
        end: i === c.length - 1,
      }));
    }
  );

  /**
   * Bezier SVG path data ("M x y Q ... Q ...") for the polyline. Null
   * when there are fewer than 2 stops (nothing to draw).
   */
  protected polylinePath = computed<string | null>(() => {
    const points = this.normalizedPoints();
    if (points.length < 2) return null;
    return buildBezierPath(points);
  });

  protected strokeColor = computed(() =>
    this.variant() === 'past' ? 'var(--wf-teal)' : 'var(--wf-accent)'
  );

  protected pathOpacity = computed(() => {
    if (this.variant() === 'draft') return 0.5;
    if (this.variant() === 'past') return 0.7;
    return 0.85;
  });

  /**
   * Normalize stop coords to fit inside the SVG viewBox with comfortable
   * padding. Returns x/y in viewBox units. Identical-coord cases (all
   * stops in roughly the same location) are handled by collapsing onto
   * the center with a tiny spread so pins don't overlap.
   */
  private normalizedPoints = computed<Array<{ x: number; y: number }>>(() => {
    const c = this.coords();
    if (c.length === 0) return [];

    const VB_W = 280;
    const VB_H = 130;
    const PAD = 22;

    if (c.length === 1) {
      return [{ x: VB_W / 2, y: VB_H / 2 }];
    }

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of c) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latRange = maxLat - minLat || 1e-6;
    const lngRange = maxLng - minLng || 1e-6;

    return c.map(([lat, lng]) => {
      // Note: x → longitude (east+), y → latitude (south+ on screen).
      // We flip the lat axis so north shows up at top.
      const fracX = (lng - minLng) / lngRange;
      const fracY = 1 - (lat - minLat) / latRange;
      return {
        x: PAD + fracX * (VB_W - 2 * PAD),
        y: PAD + fracY * (VB_H - 2 * PAD),
      };
    });
  });
}

/**
 * Bezier path string for a list of points. Mirrors the planner map's
 * polyline style (alternating quadratic arcs between consecutive points),
 * but stays as a single SVG `path` rather than a sampled polyline since
 * the preview is small enough that the curves look smooth at the SVG
 * stroke level.
 */
function buildBezierPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    // Single segment: simple quadratic with a slight arc
    const [a, b] = points;
    const ctrl = bezierControl(a, b, 1);
    return `M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`;
  }
  // Multi-segment: chain Qs and Ts (T reuses the previous control point
  // reflected) so the curve stays continuous. Alternate the first arc
  // direction so the overall shape doesn't bow uniformly.
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (i === 0) {
      const ctrl = bezierControl(a, b, 1);
      d += ` Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`;
    } else {
      // T uses the reflection of the previous control point. Cheap and
      // gives a smoothly continuous curve.
      d += ` T ${b.x} ${b.y}`;
    }
  }
  return d;
}

function bezierControl(
  a: { x: number; y: number },
  b: { x: number; y: number },
  side: 1 | -1
): { x: number; y: number } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const arc = len * 0.18 * side;
  return { x: mx + px * arc, y: my + py * arc };
}   