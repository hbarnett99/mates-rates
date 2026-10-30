import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decide, signupRequest } from './decide';
import { verifyNeonWebhook, type WebhookHeaders } from './verify';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
const lookup = async (kid: string) => (kid === 'k1' ? JWK : null);

/** Signs a body the way Neon Auth does. */
function signed(rawBody: string, timestamp = String(Date.now()), key = privateKey): WebhookHeaders {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'k1' })).toString('base64url');
  const payload = Buffer.from(`${timestamp}.${Buffer.from(rawBody).toString('base64url')}`).toString('base64url');
  const signature = sign(null, Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return { signature: `${header}..${signature}`, kid: 'k1', timestamp };
}

const event = (email: string | undefined, provider: string) =>
  JSON.stringify({ event_type: 'user.before_create', user: { email }, event_data: { auth_provider: provider } });

describe('verifyNeonWebhook', () => {
  it('accepts a correctly signed body', async () => {
    const body = event('a@example.com', 'google');
    expect(await verifyNeonWebhook(body, signed(body), lookup)).toMatchObject({ event_type: 'user.before_create' });
  });

  it('rejects a tampered body, a wrong key, an unknown kid, a stale timestamp or missing headers', async () => {
    const body = event('a@example.com', 'google');
    expect(await verifyNeonWebhook(event('evil@example.com', 'google'), signed(body), lookup)).toBeNull();
    const other = generateKeyPairSync('ed25519').privateKey;
    expect(await verifyNeonWebhook(body, signed(body, undefined, other), lookup)).toBeNull();
    expect(await verifyNeonWebhook(body, { ...signed(body), kid: 'k2' }, lookup)).toBeNull();
    expect(await verifyNeonWebhook(body, signed(body, String(Date.now() - 6 * 60 * 1000)), lookup)).toBeNull();
    expect(await verifyNeonWebhook(body, { signature: null, kid: null, timestamp: null }, lookup)).toBeNull();
  });

  it('rejects a signature that isn’t detached', async () => {
    const body = event('a@example.com', 'google');
    const headers = signed(body);
    const attached = headers.signature?.replace('..', `.${Buffer.from(body).toString('base64url')}.`) ?? null;
    expect(await verifyNeonWebhook(body, { ...headers, signature: attached }, lookup)).toBeNull();
  });
});

describe('decide', () => {
  const allowed = async (email: string) => email === 'mate@example.com';

  it('lets an allowlisted Google sign-up through, whatever the email case', async () => {
    const request = signupRequest(JSON.parse(event('Mate@Example.com', 'google')));
    expect(request).toEqual({ email: 'mate@example.com', provider: 'google' });
    expect(await decide(request ?? { email: null, provider: null }, allowed)).toEqual({ allowed: true });
  });

  it('turns away strangers, other sign-in methods and events with no email', async () => {
    expect((await decide({ email: 'stranger@example.com', provider: 'google' }, allowed)).allowed).toBe(false);
    expect((await decide({ email: 'mate@example.com', provider: 'credential' }, allowed)).allowed).toBe(false);
    expect((await decide({ email: null, provider: 'google' }, allowed)).allowed).toBe(false);
  });

  it('ignores other event types', () => {
    expect(signupRequest({ event_type: 'user.created' })).toBeNull();
  });
});
