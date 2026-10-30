import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getMember } from '@/lib/auth/server';

/**
 * Server-side gate for every crew page. proxy.ts already redirects signed-out
 * visitors, but proxy bypass bugs have happened, so check again here. RLS is
 * the final lock either way.
 */
export default async function CrewLayout({ children }: { children: ReactNode }) {
  const member = await getMember();
  if (member === 'signed-out') redirect('/login');
  if (member === 'not-allowed') redirect('/not-on-the-list');
  return children;
}
