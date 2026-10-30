import { redirect } from 'next/navigation';
import { DealsApp } from '@/components/deals-app';
import { getMember } from '@/lib/auth/server';
import { resolveDateParam } from '@/lib/dates';
import { withUser } from '@/lib/db';
import { listDeals, listVenues } from '@/lib/db/queries';
import { melbourneDate } from '@/lib/deals/is-deal-on';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The one screen: map and list for ?date= (default today in Melbourne).
 * All deals load here in one query; the list for the chosen date renders
 * on the server, and later date changes filter on the device.
 */
export default async function HomePage({ searchParams }: Props) {
  const [member, params] = await Promise.all([getMember(), searchParams]);
  if (member === 'signed-out') redirect('/login');
  if (member === 'not-allowed') redirect('/not-on-the-list');

  const { deals, venues } = await withUser(member, async (tx) => ({
    deals: await listDeals(tx),
    venues: await listVenues(tx),
  }));

  const today = melbourneDate();
  return (
    <DealsApp
      initialDeals={deals}
      venues={venues}
      today={today}
      initialDate={resolveDateParam(params.date)}
      viewer={{ id: member.id, isOwner: member.isOwner }}
      email={member.email}
    />
  );
}
