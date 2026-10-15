import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBackendUrl } from '../lib/backend-url.ts';

test('local development and production checks retain the local backend default', () => {
  assert.equal(resolveBackendUrl({}), 'http://localhost:5000');
  assert.equal(resolveBackendUrl({ BACKEND_URL: ' http://127.0.0.1:8002/ ' }), 'http://127.0.0.1:8002');
});

test('Vercel requires a public HTTPS backend and normalizes its origin', () => {
  assert.equal(resolveBackendUrl({ VERCEL: '1', BACKEND_URL: 'https://api.travel-mate.site/' }), 'https://api.travel-mate.site');
  for (const BACKEND_URL of [undefined, '', 'http://localhost:5000', 'https://localhost', 'https://127.0.0.1:8002', 'https://[::1]', 'http://api.travel-mate.site']) {
    assert.throws(() => resolveBackendUrl({ VERCEL: '1', BACKEND_URL }), /BACKEND_URL/);
  }
});

test('bad schemes, credentials, duplicated API paths and malformed URLs cannot form proxy destinations', () => {
  for (const BACKEND_URL of ['backend_url', 'api.travel-mate.site', 'ftp://api.travel-mate.site', 'https://user:password@api.travel-mate.site', 'https://api.travel-mate.site/api', 'https://api.travel-mate.site?key=test', 'https://api.travel-mate.site#test']) {
    assert.throws(() => resolveBackendUrl({ BACKEND_URL }), /BACKEND_URL/);
  }
});
