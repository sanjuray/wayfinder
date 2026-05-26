import {
  Component,
  input,
  output,
  signal,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';

/**
 * The signature visual moment. Plays once per save:
 *
 *  1. Compass rim fades in at the pin's lat/lng (~0.2s)
 *  2. Needle appears and wavers like a real magnetic needle searching for north (~1.2s)
 *  3. Needle snaps to position (the lat/lng) (~0.1s)
 *  4. Pin emerges from the compass center with a slight bounce (~0.5s)
 *  5. Toast slides up from the bottom (~2.4s total)
 *
 * Total runtime: ~2.4s. Fires `done` event when finished so the parent
 * can clean up.
 */

@Component({
  selector: 'wf-pin-drop-celebration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
      <div class="overlay" [class.show]="show()"></div>

  <div
    class="stage"
    [class.show]="show()"
    [style.left.px]="x()"
    [style.top.px]="y()"
  >
    <!-- The compass that appears at the location -->
    <div class="rim"></div>
    <div class="cardinal n">N</div>
    <div class="cardinal s">S</div>
    <div class="cardinal e">E</div>
    <div class="cardinal w">W</div>

    <!-- The wobbling needle -->
    <div class="needle"></div>
    <!-- Target rings: lock in after the needle settles, anchor through the landing -->
    <div class="target-ring r2" [style.border-color]="color()"></div>
    <div class="target-ring r1" [style.border-color]="color()"></div>

    <!-- Pin stem grows up first -->
    <div class="stem"></div>

    <!-- Pin head drops from above onto the stem -->
    <div class="pin-head" [style.background]="color()"></div>
  </div>

  @if (placeName()) {
    <div class="toast" [class.show]="show()">
      Saved <span class="star">✦</span> {{ placeName() }}
    </div>
  }
  `,
  styleUrl: './pin-drop-celebration.component.css',
})
export class PinDropCelebrationComponent implements AfterViewInit {
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly color = input<string>('#FF6B5B');
  readonly placeName = input<string>('');
  readonly done = output<void>();

  protected show = signal(false);

  ngAfterViewInit(): void {
    requestAnimationFrame(() => this.show.set(true));
    setTimeout(() => this.done.emit(), 2400);
  }
}
