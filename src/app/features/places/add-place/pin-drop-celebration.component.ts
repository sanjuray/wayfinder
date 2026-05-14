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
 * dim overlay → pin scales in with bounce → 2 pulse rings → 12 sparkles → toast.
 * Total ~2.4s. Fires done event when finished so the parent can clean up.
 */
@Component({
  selector: 'wf-pin-drop-celebration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay" [class.show]="show()"></div>
    <div
      class="pin-wrap"
      [class.show]="show()"
      [style.left.px]="x()"
      [style.top.px]="y()"
    >
      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="pin" [style.background]="color()">
        <span class="ico">📍</span>
      </div>
      @for (a of angles; track a) {
        <div class="spark" [style.--angle.deg]="a"></div>
      }
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
  protected angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  ngAfterViewInit(): void {
    requestAnimationFrame(() => this.show.set(true));
    setTimeout(() => this.done.emit(), 2400);
  }
}