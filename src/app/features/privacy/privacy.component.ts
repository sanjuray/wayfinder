import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
 
/**
 * The "full story" behind the signup consent line. Standalone route (/privacy),
 * reachable from the consent checkbox and — later — the footer/about.
 *
 * IMPORTANT: the copy here is an honest scaffold, written to match the data
 * decisions actually made so far (local-first guests, account sync, no selling/
 * ads, anonymous aggregate metrics). Anything in [[ DOUBLE BRACKETS ]] is a
 * placeholder YOU must fill in with real specifics (contact address, hosting
 * region, retention periods, etc.), and the whole thing should get a legal
 * once-over before you rely on it for real users. Don't promise here anything
 * the app doesn't actually do.
 */
@Component({
  selector: 'wf-privacy',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.css',
})
export class PrivacyComponent {
  /** Last meaningful update — bump when the policy actually changes. */
  protected readonly lastUpdated = '28 July 2026';
  protected readonly age = 'PG-13';
  protected readonly contactMail = 'rabbreva@gmail.com';
}