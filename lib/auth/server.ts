import 'server-only';
import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';
import { connection } from 'next/server';
import { cache } from 'react';
import { withUser } from '@/lib/db';
import { crewRole, upsertProfile } from '@/lib/db/queries';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

let instance: NeonAuth | undefined;

/**
 * The Neon Auth server instance. Created on first use rather than at import,
 * so `next build` doesn't need the auth secrets.
 */
export function auth(): NeonAuth {
  instance ??= createNeonAuth({
    baseUrl: required('NEON_AUTH_BASE_URL'),
    cookies: { secret: required('NEON_AUTH_COOKIE_SECRET') },
  });
  return instance;
}

export type Member = { id: string; email: string; isOwner: boolean };

/**
 * The signed-in user if they're on the allowlist, 'signed-out' if there's no
 * valid session, or 'not-allowed' if they're signed in but not on the list.
 * Neon Auth can't block sign-ups, so anyone with a Google account can get a
 * session; this check (and RLS behind it) is what keeps them out. Cached
 * per request, so the layout and page share one check.
 */
export const getMember = cache(async (): Promise<Member | 'signed-out' | 'not-allowed'> => {
  // Every page that checks the session depends on the request.
  await connection();
  const { data } = await auth().getSession();
  const user = data?.user;
  if (!user) return 'signed-out';
  // Google always verifies emails. An unverified one came from some other
  // sign-in method and could claim any address, so it never counts.
  if (!user.emailVerified || !user.email) return 'not-allowed';

  const email = user.email.toLowerCase();
  const role = await withUser({ id: user.id, email }, async (tx) => {
    const found = await crewRole(tx);
    if (found) await upsertProfile(tx, { displayName: user.name || null, avatarUrl: user.image ?? null });
    return found;
  });
  if (!role) return 'not-allowed';
  return { id: user.id, email, isOwner: role === 'owner' };
});
