import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createPortServer } from 'node:net';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

let app;
let base;
let log = '';
const requests = [];
const upstream = createServer((request, response) => {
  requests.push({ url: request.url, headers: request.headers });
  if (request.headers['x-forwarded-proto'] !== 'https') { response.writeHead(426); response.end(); return; }
  response.writeHead(302, { location: 'https://accounts.google.test/authorize',
    'set-cookie': ['travelmate_google_flow=test; HttpOnly; Secure; Path=/', 'audit_callback=test; HttpOnly; Secure; Path=/'] });
  response.end();
});

async function unusedPort() {
  const server = createPortServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

before(async () => {
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const port = await unusedPort();
  base = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', BACKEND_URL: `http://127.0.0.1:${upstream.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { log = (log + data).slice(-8000); });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error(`Next exited before readiness: ${log}`);
    try { if ((await fetch(base, { headers: { 'x-forwarded-proto': 'https' }, signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await delay(250);
  }
  throw new Error(`Production Next readiness timed out: ${log}`);
});

after(async () => {
  if (app && app.exitCode === null) {
    const exited = new Promise(resolve => app.once('exit', resolve));
    app.kill();
    await Promise.race([exited, delay(5000)]);
    if (app.exitCode === null) app.kill('SIGKILL');
  }
  await new Promise(resolve => upstream.close(resolve));
});

test('HTTPS application/API enforcement and unauthenticated dashboard protection remain active', async () => {
  for (const path of ['/', '/api/auth']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(new URL(response.headers.get('location')).protocol, 'https:');
  }
  const dashboard = await fetch(`${base}/dashboard`, { redirect: 'manual', headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(dashboard.status, 307);
  assert.equal(new URL(dashboard.headers.get('location'), base).searchParams.get('auth_error'), 'unauthenticated');
});

test('source and optimized local images work behind HTTPS termination', async () => {
  for (const path of ['/cordova-nalusuan.png', '/_next/image?url=%2Fcordova-nalusuan.png&w=1200&q=75']) {
    const response = await fetch(`${base}${path}`, { headers: { 'x-forwarded-proto': 'https' }, signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200, `${path}: ${log}`);
    assert.match(response.headers.get('content-type'), /^image\//);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
});

test('Google start and callback forward trusted HTTPS, client IP, query and cookies to an internal HTTP backend', async () => {
  for (const path of ['/api/auth/oauth/google', '/api/auth/oauth/google/callback?code=test-code&state=test-state']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual', headers: {
      'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.10, 10.0.0.2', cookie: 'travelmate_google_flow=sealed-flow',
    } });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://accounts.google.test/authorize');
    assert.equal(response.headers.getSetCookie().length, 2);
    const received = requests.at(-1);
    assert.equal(received.url, path);
    assert.equal(received.headers['x-forwarded-proto'], 'https');
    assert.equal(received.headers['x-forwarded-for'], '203.0.113.10');
    assert.equal(received.headers.cookie, 'travelmate_google_flow=sealed-flow');
  }
});
