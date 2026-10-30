import { auth } from '@/lib/auth/server';

type Context = { params: Promise<{ path: string[] }> };

// Proxies the browser's auth requests to Neon Auth. Wrapped so the auth
// instance is only created when a request arrives, not at build time.
export function GET(request: Request, context: Context) {
  return auth().handler().GET(request, context);
}

export function POST(request: Request, context: Context) {
  return auth().handler().POST(request, context);
}
