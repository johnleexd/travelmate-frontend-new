import assert from 'node:assert/strict';
import test from 'node:test';
import { signOut, signedOutLocation } from '../services/session.service.ts';

test('sign-out must be confirmed by the server before navigation can continue', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Sign-out temporarily unavailable.' }, { status: 503 }));
  await assert.rejects(signOut(), /Sign-out temporarily unavailable/);
});

test('sign-out accepts a confirmed response and rejects malformed success responses', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(String(options.body)), { action: 'logout' });
    return Response.json({ ok: true, sessionRevoked: true });
  });
  await signOut();
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(signOut(), /Could not confirm sign-out/);
});

test('local cookie clearing during an outage is distinguished from server revocation', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, sessionRevoked: false }));
  const result = await signOut();
  assert.equal(signedOutLocation(result), '/?auth_error=logout_unconfirmed');
  assert.equal(signedOutLocation({ sessionRevoked: true }), '/');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true }));
  await assert.rejects(signOut(), /Could not confirm sign-out/);
});
