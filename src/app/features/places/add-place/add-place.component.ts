import { Component, inject, output, input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AddPlaceFacade } from './add-place.facade';
import { PasteLinkStepComponent } from './steps/paste-link-step.component';
import { ConfirmLocationStepComponent } from './steps/confirm-location-step.component';
import { CategorizeStepComponent } from './steps/categorize-step.component';
import { SaveStepComponent } from './steps/save-step.component';
import type { Place } from '../../../core/models';

@Component({
  selector: 'wf-add-place',
  standalone: true,
  // Per-flow facade — fresh state for each modal instance
  providers: [AddPlaceFacade],
  imports: [
    PasteLinkStepComponent,
    ConfirmLocationStepComponent,
    CategorizeStepComponent,
    SaveStepComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay" (click)="onCancel()"></div>
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="step-row">
        @for (s of steps; track s) {
          <span [class.on]="facade.step() === s" [class.done]="facade.step() > s"></span>
        }
      </div>

      @switch (facade.step()) {
        @case (1) {
          <wf-paste-link-step (cancelled)="onCancel()" />
        }
        @case (2) {
          <wf-confirm-location-step />
        }
        @case (3) {
          <wf-categorize-step />
        }
        @case (4) {
          <wf-save-step (save)="onSave()" />
        }
      }
    </div>
  `,
  
styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(2px);
      }
      .modal {
        position: relative;
        padding: 28px;
        background: var(--wf-bg);
        border-radius: 18px;
        max-width: 460px;
        width: calc(100% - 32px);
        max-height: 90vh;
        overflow-y: auto;
        border: 0.5px solid var(--wf-hairline);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      }
      .step-row {
        display: flex;
        gap: 6px;
        margin-bottom: 20px;
        justify-content: center;
      }
        .step-row span {
        width: 34px;
        height: 4px;
        border-radius: 2px;
        background: var(--wf-hairline);
        transition: all 0.3s;
      }
      .step-row span.on {
        background: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .step-row span.done {
        background: var(--wf-ink);
      }
    `,
  ],
})
export class AddPlaceComponent implements OnInit{
  protected facade = inject(AddPlaceFacade);
  protected steps = [1, 2, 3, 4];

  readonly prefillCoords = input<{ lat: number; lng: number } | null>(null);
  readonly editingPlace = input<Place | null>(null);
  readonly saved = output<Place>();
  readonly cancelled = output<void>();

  ngOnInit(): void {
    const place = this.editingPlace();
    if(place){
      //Edit mode - pre-populate and jump to step 2
      this.facade.enterEditMode(place);
      return;
    }

    const coords = this.prefillCoords();
    if (coords) {
      // Map-click mode - skip to step 2 with resolved coords
      this.facade.setDraftFromMapClick(coords.lat, coords.lng);
    }

    //Otherwise: normal step 1 (paste link / address)
  }

  async onSave(): Promise<void> {
    const place = await this.facade.save();
    if (place) {
      this.saved.emit(place);
      this.facade.reset();
    }
  }

  onCancel(): void {
    this.facade.reset();
    this.cancelled.emit();
  }
}