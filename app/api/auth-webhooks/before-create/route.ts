import { withUser } from '@/lib/db';
import { isAllowedSignup } from '@/lib/db/queries';
import { decide, signupRequest } from '@/lib/signup-gate/decide';
import { jwksLookup, verifyNeonWebhook, type KeyLookup } from '@/lib/signup-gate/verify';

/**
 * Neon Auth's user.before_create webhook. Rejects any sign-up whose email
 * isn't in allowed_emails, so strangers never get an account. Neon Auth
 * fails closed: if this route errors or is unreachable, the sign-up is
 * refused.
 */

export const dynamic = 'force-dynamic';

let lookupKey: KeyLookup | undefined;

function keys(): KeyLookup {
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) throw new Error('Missing environment variable NEON_AUTH_BASE_URL. See .env.example.');
  lookupKey ??= jwksLookup(`${base.replace(/\/$/, '')}/.well-known/jwks.json`);
  return lookupKey;
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const body = await verifyNeonWebhook(
    rawBody,
    {
      signature: request.headers.get('x-neon-signature'),
      kid: request.headers.get('x-neon-signature-kid'),
      timestamp: request.headers.get('x-neon-timestamp'),
    },
    keys(),
  );
  if (body === null) return new Response('Invalid signature', { status: 401 });

  const signup = signupRequest(body);
  if (!signup) return new Response('Unexpected event', { status: 400 });

  const decision = await decide(signup, (email) => withUser(null, (tx) => isAllowedSignup(tx, email)));
  console.log('signup gate', { provider: signup.provider, allowed: decision.allowed });
  return Response.json(decision);
}
