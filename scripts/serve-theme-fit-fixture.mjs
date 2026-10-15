// Local UI fixture only: no private records, credentials, backend access or writes.
import fs from 'node:fs';
import http from 'node:http';
const audit = '../audit/2026-10-13/theme-fit';
fs.mkdirSync(audit, { recursive: true });
const user = { id: 'theme-fixture', name: 'UI Test Traveler', email: 'ui@example.test', role: 'traveler', accountStatus: 'active', emailVerified: true };
const workspace = { user, trips: [], notifications: [], listings: [], bookings: [], itineraryVersions: [], itineraryGenerations: [], directory: [], moderation: [], audit: [] };
const reply = (response, status, value) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); };
const proxy = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost:3004');
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET' && request.method !== 'HEAD') { reply(response, 403, { error: 'UI fixture is read-only.' }); return; }
    if (url.pathname === '/api/platform' || url.pathname === '/api/accommodations') {
      const hold = audit + (url.pathname === '/api/platform' ? '/hold-workspace' : '/hold-accommodations');
      while (fs.existsSync(hold) && !response.destroyed) await new Promise(resolve => setTimeout(resolve, 500));
      if (response.destroyed) return;
    }
    if (url.pathname === '/api/platform') { reply(response, 200, workspace); return; }
    if (url.pathname === '/api/auth') { reply(response, 200, { user }); return; }
    if (url.pathname === '/api/locations') { reply(response, 200, { locations: [{ id: 1, name: 'Berlin', country: 'Germany', countryCode: 'DE', latitude: 52.52, longitude: 13.405, label: 'Berlin, Germany' }] }); return; }
    if (url.pathname === '/api/destination-context') { reply(response, 200, { currency: 'EUR', currencySource: 'country-code', transportation: [], transportationMessage: '' }); return; }
    if (url.pathname === '/api/accommodations') { reply(response, 200, { configured: true, accommodations: [], nearbyAccommodations: [], providerAccommodations: Array.from({ length: 7 }, (_, i) => ({ id: 'liteapi:ui-' + i, propertyId: 'ui-' + i, name: 'UI test stay ' + (i + 1), nameSource: 'provider-english', address: 'Berlin, Germany · UI fixture', type: 'Hotel', latitude: 52.52, longitude: 13.405, distanceKm: 1, rating: 3, amenities: [], photos: [], environment: 'sandbox', availability: 'price-unavailable' })), status: 'ready', providerStatus: 'ready', providerEnvironment: 'sandbox' }); return; }
    reply(response, 503, { error: 'Unavailable in isolated UI fixture.' }); return;
  }
  // The dummy cookie passes the local frontend's presence-only route guard;
  // it is not a backend session and no request is forwarded to the backend.
  const target = http.request({ hostname: '127.0.0.1', port: 3000, path: request.url, method: request.method, headers: { ...request.headers, host: 'localhost:3000', origin: 'http://localhost:3000', cookie: 'travelmate_session=isolated-ui-fixture' } }, upstream => {
    const headers = { ...upstream.headers, 'cache-control': 'no-store' }; delete headers['set-cookie'];
    response.writeHead(upstream.statusCode || 502, headers); upstream.pipe(response);
  });
  target.on('error', () => { response.writeHead(502); response.end('Local frontend unavailable'); }); request.pipe(target);
});
proxy.on('upgrade', (request, socket, head) => {
  const target = http.request({ hostname: '127.0.0.1', port: 3000, path: request.url, headers: { ...request.headers, host: 'localhost:3000', origin: 'http://localhost:3000' } });
  target.on('upgrade', (upstream, remote, extra) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(upstream.headers).map(([key, value]) => `${key}: ${value}\r\n`).join('') + '\r\n');
    if (head.length) remote.write(head); if (extra.length) socket.write(extra); remote.pipe(socket); socket.pipe(remote);
    remote.on('error', () => socket.destroy()); socket.on('error', () => remote.destroy());
  });
  target.on('error', () => socket.destroy()); target.end();
});
proxy.listen(3004, '127.0.0.1', () => console.log('Isolated read-only UI fixture: http://localhost:3004/dashboard?tab=feedback'));
const stop = setInterval(() => { if (fs.existsSync(audit + '/stop-browser')) { clearInterval(stop); proxy.close(); proxy.closeAllConnections(); process.exit(0); } }, 1500);
