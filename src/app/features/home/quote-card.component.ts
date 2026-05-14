import {
  Component,
  input,
  output,
  signal,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';

/**
 * Floating quote card that appears at given screen coordinates,
 * fades in, auto-dismisses after 4 seconds.
 */
@Component({
  selector: 'wf-quote-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="card"
      [class.show]="show()"
      [style.left.px]="x()"
      [style.top.px]="y()"
    >
      <div class="text">{{ text() }}</div>
      <div class="arrow"></div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1500;
      }
      .card {
        position: absolute;
        transform: translate(-50%, -100%) translateY(-16px);
        background: var(--wf-ink);
        color: var(--wf-bg);
        padding: 14px 18px;
        border-radius: var(--wf-radius-card);
        max-width: 280px;
        font-family: var(--wf-font-handwrite);
        font-size: 14px;
        line-height: 1.5;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      .card.show {
        opacity: 1;
        transform: translate(-50%, -100%) translateY(-8px);
      }
     .arrow {
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        width: 12px;
        height: 12px;
        background: var(--wf-ink);
      }
    `,
  ],
})
export class QuoteCardComponent implements AfterViewInit {
  readonly text = input.required<string>();
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly done = output<void>();

  protected show = signal(false);

  ngAfterViewInit(): void {
    requestAnimationFrame(() => this.show.set(true));
    setTimeout(() => this.done.emit(), 4000);
  }
}