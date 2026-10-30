import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';

/** Paths a signed-out visitor may load. Neon Auth also lets /login through. */
const PUBLIC_PATHS = ['/not-on-the-list', '/api/auth/', '/api/auth-webhooks/', '/api/refresh-venues'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p));
}

/**
 * Neon Auth's middleware refreshes the session cookie, finishes the Google
 * sign-in when the browser comes back from Neon Auth, and sends signed-out
 * visitors to /login. This is only the first gate: app/(crew)/layout.tsx
 * checks the allowlist and RLS is the final lock.
 */
export async function proxy(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname)) return NextResponse.next();
  return auth().middleware({ loginUrl: '/login' })(request);
}

export const config = {
  matcher: [
    // Everything except static files, images and metadata files.
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|icons/).*)',
  ],
};
