/**
 * Self-host environment — used by `ng build --configuration=selfhost`.
 *
 * apiBaseUrl is RELATIVE ('/api', no host). This is the key to a no-domain
 * self-host: the browser sends API calls to whatever host it loaded the app
 * from — http://localhost, http://192.168.x.x (your LAN), or the tunnel URL —
 * and nginx on the phone proxies /api to the backend. One build works for every
 * way of reaching it; you never rebuild when the address changes.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
};
