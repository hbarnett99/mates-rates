export type Decision =
  | { allowed: true }
  | { allowed: false; error_message: string; error_code: string };

const NOT_ON_LIST: Decision = {
  allowed: false,
  error_message: 'This email is not on the Mates Rates list.',
  error_code: 'NOT_ON_LIST',
};

/** What the gate needs from a user.before_create event. */
export function signupRequest(body: unknown): { email: string | null; provider: string | null } | null {
  if (typeof body !== 'object' || body === null) return null;
  if (!('event_type' in body) || body.event_type !== 'user.before_create') return null;
  const user = 'user' in body && typeof body.user === 'object' && body.user !== null ? body.user : null;
  const data = 'event_data' in body && typeof body.event_data === 'object' && body.event_data !== null ? body.event_data : null;
  const email = user && 'email' in user && typeof user.email === 'string' ? user.email.toLowerCase() : null;
  const provider = data && 'auth_provider' in data && typeof data.auth_provider === 'string' ? data.auth_provider : null;
  return { email, provider };
}

/**
 * Only Google sign-ups for allowlisted emails get an account. Google
 * verifies the address; any other method could claim someone else's.
 */
export async function decide(
  request: { email: string | null; provider: string | null },
  isAllowed: (email: string) => Promise<boolean>,
): Promise<Decision> {
  if (request.provider !== 'google' || !request.email) return NOT_ON_LIST;
  return (await isAllowed(request.email)) ? { allowed: true } : NOT_ON_LIST;
}
