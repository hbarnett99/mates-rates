import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMember } from '@/lib/auth/server';
import { GoogleSignInButton } from './google-sign-in-button';

export const metadata: Metadata = { title: 'Sign in · Mates Rates' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const [member, params] = await Promise.all([getMember(), searchParams]);
  if (member === 'not-allowed') redirect('/not-on-the-list');
  if (member !== 'signed-out') redirect('/');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Mates <span className="text-accent">Rates</span>
        </h1>
        <p className="text-muted">The crew&apos;s food and drink deals, on a map.</p>
      </div>
      <GoogleSignInButton />
      {params.error !== undefined && (
        <p role="alert" className="text-sm text-danger">
          Sign-in didn&apos;t work. Try again.
        </p>
      )}
    </main>
  );
}
