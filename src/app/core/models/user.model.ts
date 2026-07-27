/**
 * The authenticated user. Mirrors the backend's UserDto exactly — no token
 * field here, ever. The JWT lives only in the httpOnly cookie the browser
 * manages; JavaScript (and therefore this app) never sees it directly.
 */
export type Plan = 'freemium' | 'circle';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  plan: Plan;
}