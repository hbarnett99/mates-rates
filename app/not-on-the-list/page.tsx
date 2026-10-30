import type { Metadata } from 'next';
import { signOut } from '@/app/actions/auth';

export const metadata: Metadata = { title: "You're not on the list · Mates Rates" };

/**
 * Shown when someone signs in with a Google account that isn't on the
 * allowlist, or has been taken off it.
 */
export default function NotOnTheListPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">You&apos;re not on the list</h1>
        <p className="mx-auto max-w-sm text-muted">
          Mates Rates is just for the crew. If you should be in, ask whoever runs it to add your Google email, then try
          again.
        </p>
      </div>
      <form action={signOut}>
        <button type="submit" className="min-h-12 rounded-full bg-raised px-6 font-medium hover:bg-surface">
          Try another Google account
        </button>
      </form>
    </main>
  );
}
