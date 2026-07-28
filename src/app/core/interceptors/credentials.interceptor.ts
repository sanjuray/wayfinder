import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Ensures every request includes credentials (cookies) — without this,
 * the browser won't send the httpOnly auth cookie even to a same-site API,
 * because Angular's HttpClient defaults withCredentials to false.
 *
 * This replaces what used to be a manual "attach Authorization: Bearer"
 * step: with an httpOnly cookie, there's nothing for this code to read or
 * attach — the browser handles sending the cookie by itself, once told to.
 * 
 * Attaches redentials (cookies) ONLY to requests aimed at our own backend,
 * so the browser sends the httpOnly auth cookie on API calls. Angular's 
 * HttpClient defaults withCredentials to false, so without this the cookie
 * would never be sent.
 * 
 * Critically, this must NOT fire for third party requests (Nomatin, tile 
 * servers, any external API). Turning on credentialed mode makes the browser
 * enforece strict CORS on the response: the server must echo the exact originl
 * plus Access-Control-Allow-Credentials: true. A public API like Nominatim
 * replies with Access-Control-Allow-Origin: * and no crednetials header -
 * perfectly valid nomrally, but the browser rejects it under credentialed 
 * mode, surfacing as "No 'Access-Control-Allow-Origin' header is present"
 * even on a 200 response. So we scope credentials to our API base only and
 * leave everything else as an ordinary, un-credentialed request.
 * 
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const isOwnApi = req.url.startsWith(environment.apiBaseUrl);
  return isOwnApi ? next(req.clone({ withCredentials: true })) : next(req);
};
