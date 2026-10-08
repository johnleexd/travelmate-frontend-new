import assert from 'node:assert/strict';
import test from 'node:test';
import { oauthRequestHeaders } from '../lib/oauth-request-headers.ts';

test('OAuth retains the trusted HTTPS boundary, client IP, and flow cookie', () => {
  const result = oauthRequestHeaders(new Request('http://next.internal/api/auth/oauth/google', { headers: {
    'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    cookie: 'travelmate_google_flow=sealed-state', authorization: 'secret-not-needed-by-oauth',
  } }));
  assert.equal(result.get('x-forwarded-proto'), 'https');
  assert.equal(result.get('x-forwarded-for'), '203.0.113.10');
  assert.equal(result.get('cookie'), 'travelmate_google_flow=sealed-state');
  assert.equal(result.get('authorization'), null);
});

test('without proxy headers, OAuth uses the actual request protocol and does not invent a client IP', () => {
  const result = oauthRequestHeaders(new Request('https://travelmate.example/api/auth/oauth/google'));
  assert.equal(result.get('x-forwarded-proto'), 'https');
  assert.equal(result.get('x-forwarded-for'), null);
  assert.equal(oauthRequestHeaders(new Request('http://localhost/api/auth/oauth/google')).get('x-forwarded-proto'), 'http');
});
