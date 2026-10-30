import { createPublicKey, verify, type webcrypto } from 'node:crypto';

type JsonWebKey = webcrypto.JsonWebKey;

/** Neon Auth webhook signatures go stale after this long. */
const MAX_AGE_MS = 5 * 60 * 1000;

export type WebhookHeaders = {
  signature: string | null;
  kid: string | null;
  timestamp: string | null;
};

/** Looks up a public key by id from Neon Auth's JWKS. */
export type KeyLookup = (kid: string) => Promise<JsonWebKey | null>;

/**
 * Checks a Neon Auth webhook: an Ed25519 detached JWS over
 * base64url(timestamp + "." + base64url(rawBody)), signed with a key from
 * Neon Auth's JWKS. Returns the parsed body, or null if anything is off.
 * https://neon.com/docs/auth/guides/webhooks
 */
export async function verifyNeonWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  lookupKey: KeyLookup,
  now: number = Date.now(),
): Promise<unknown> {
  const { signature, kid, timestamp } = headers;
  if (!signature || !kid || !timestamp) return null;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > MAX_AGE_MS) return null;

  const parts = signature.split('.');
  const [protectedHeader, detached, signatureB64] = parts;
  if (parts.length !== 3 || !protectedHeader || detached !== '' || !signatureB64) return null;

  const jwk = await lookupKey(kid);
  if (!jwk) return null;

  const payloadB64 = Buffer.from(rawBody).toString('base64url');
  const signedPayloadB64 = Buffer.from(`${timestamp}.${payloadB64}`).toString('base64url');
  let valid = false;
  try {
    valid = verify(
      null,
      Buffer.from(`${protectedHeader}.${signedPayloadB64}`),
      createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(signatureB64, 'base64url'),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

/** A key lookup that caches Neon Auth's JWKS and refetches, at most once a minute, on an unknown kid. */
export function jwksLookup(jwksUrl: string, fetchImpl: typeof fetch = fetch): KeyLookup {
  let keys = new Map<string, JsonWebKey>();
  let fetchedAt = 0;

  async function refresh(): Promise<void> {
    const response = await fetchImpl(jwksUrl);
    if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
    const body: unknown = await response.json();
    const list = typeof body === 'object' && body !== null && 'keys' in body && Array.isArray(body.keys) ? body.keys : [];
    keys = new Map();
    for (const key of list as unknown[]) {
      if (typeof key === 'object' && key !== null && 'kid' in key && typeof key.kid === 'string') {
        keys.set(key.kid, key as JsonWebKey);
      }
    }
    fetchedAt = Date.now();
  }

  return async (kid) => {
    if (!keys.has(kid) && Date.now() - fetchedAt > 60_000) await refresh();
    return keys.get(kid) ?? null;
  };
}
