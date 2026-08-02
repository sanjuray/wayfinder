import {
  Component,
  ChangeDetectionStrategy,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
 
/**
 * Wayfinder — How it works.
 *
 * A self-contained documentation page for first-time users. It explains the
 * mental model (pin places → organize → plan trips), walks each page of the
 * app, and decodes every marker/badge on the map.
 *
 * Design intent: this reads as part of Wayfinder, not a bolted-on manual. It
 * uses the app's own tokens (--wf-*), fonts (Fraunces/Manrope/Kalam), and —
 * crucially — renders the SAME pin SVGs the map uses, so the legend can never
 * drift from reality. No external image assets; every "image" is inline SVG or
 * a styled DOM mock, which means it themes automatically with the rest of the
 * app.
 *
 * Placement: registered at /help inside the workspace shell (keeps the topbar).
 * Linked from the account menu ("How Wayfinder works") and the first-run empty
 * state. Fully decoupled — no store dependencies — so it can be dropped
 * anywhere, including outside the shell, without wiring.
 */
@Component({
  selector: 'wf-help-guide',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-guide.component.html',
  styleUrl: './help-guide.component.css',
})
export class HelpGuideComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollHost', { static: false })
  private scrollHost?: ElementRef<HTMLDivElement>;

  /** Which section is currently in view — drives the sticky contents rail. */
  protected activeSection = signal<string>('start');
 
  /** Chapters, in reading order. id must match each <section data-chapter>. */
  protected readonly chapters: ReadonlyArray<{ id: string; label: string; icon: string }> = [
    { id: 'start', label: 'Getting started', icon: 'sparkles' },
    { id: 'map', label: 'The map', icon: 'map-2' },
    { id: 'pins', label: 'Reading the pins', icon: 'map-pin' },
    { id: 'adding', label: 'Adding a place', icon: 'plus' },
    { id: 'detail', label: 'A place up close', icon: 'info-circle' },
    { id: 'organize', label: 'Categories & vibes', icon: 'tags' },
    { id: 'collections', label: 'Collections', icon: 'folder' },
    { id: 'places-list', label: 'The places list', icon: 'list' },
    { id: 'trips', label: 'Trips', icon: 'route' },
    { id: 'topbar', label: 'The top bar', icon: 'layout-navbar' },
    { id: 'account', label: 'Account & backups', icon: 'user' },
    { id: 'themes', label: 'Themes', icon: 'palette' },
  ];
 
  private sectionEls: HTMLElement[] = [];
  private observer?: IntersectionObserver;
 
  constructor(private router: Router) {}
 
  ngAfterViewInit(): void {
    const host = this.scrollHost?.nativeElement;
    if (!host) return;
 
    this.sectionEls = Array.from(
      host.querySelectorAll<HTMLElement>('[data-chapter]')
    );
 
    // Highlight the contents entry whose section is nearest the top of the
    // viewport. Same approach as the settings page's section tracker.
    this.observer = new IntersectionObserver(
      () => {
        const line = 120; // header offset
        let current: string | null = null;
        for (const el of this.sectionEls) {
          if (el.getBoundingClientRect().top <= line) {
            current = el.dataset['chapter'] ?? current;
          }
        }
        if (!current && this.sectionEls.length) {
          current = this.sectionEls[0].dataset['chapter'] ?? null;
        }
        if (current) this.activeSection.set(current);
      },
      { threshold: [0, 0.01, 0.25, 0.5, 1] }
    );
 
    for (const el of this.sectionEls) this.observer.observe(el);
  }
 
  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected scrollTo(id: string): void {
    const el = this.sectionEls.find((e) => e.dataset['chapter'] === id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSection.set(id);
  }
 
  /** CTA — send a curious reader to the map to start pinning. */
  protected goToMap(): void {
    this.router.navigate(['/']);
  }
}