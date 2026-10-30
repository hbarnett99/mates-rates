'use server';

import { getMember, type Member } from '@/lib/auth/server';
import { withUser } from '@/lib/db';
import * as queries from '@/lib/db/queries';
import type { Queryable } from '@/lib/db/queryable';
import type { DealWrite } from '@/lib/db/types';
import { validateDealInput, type DealInput } from '@/lib/deals/input';
import type { Deal } from '@/lib/deals/types';
import { applyTagRules } from '@/lib/tags/rules';

export type DealResult = { ok: true; deal: Deal } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = 'You need to be signed in as one of the crew.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function member(): Promise<Member | null> {
  const found = await getMember();
  return typeof found === 'string' ? null : found;
}

function dealColumns(input: DealInput, venueId: string): DealWrite {
  return {
    venue_id: venueId,
    title: input.title,
    price_cents: input.priceCents,
    category: input.category,
    tags: applyTagRules({ title: input.title, notes: input.notes, tags: input.tags, dismissed: input.dismissedTags }),
    days: input.days,
    start_time: input.startTime,
    end_time: input.endTime,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
    notes: input.notes,
  };
}

/** Thrown inside a transaction when RLS hides the row, so nothing commits. */
class NotYours extends Error {}

/** Runs fn as the member, turning any database error into a friendly message. */
async function attempt<T>(
  user: Member,
  failure: string,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T | { error: string } | NotYours> {
  try {
    return await withUser(user, fn);
  } catch (error) {
    if (error instanceof NotYours) return error;
    console.error(failure, error);
    return { error: failure };
  }
}

export async function createDeal(raw: unknown): Promise<DealResult> {
  const input = validateDealInput(raw);
  if (!input.ok) return input;
  const user = await member();
  if (!user) return { ok: false, error: NOT_ALLOWED };

  const result = await attempt(user, 'Couldn’t save the deal. Try again.', async (tx) => {
    const venueId = await queries.resolveVenue(tx, input.value.venue);
    return queries.insertDeal(tx, dealColumns(input.value, venueId));
  });
  if (result instanceof NotYours) return { ok: false, error: NOT_ALLOWED };
  return 'error' in result ? { ok: false, error: result.error } : { ok: true, deal: result };
}

export async function updateDeal(id: unknown, raw: unknown): Promise<DealResult> {
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, error: 'Something went wrong. Try again.' };
  const input = validateDealInput(raw);
  if (!input.ok) return input;
  const user = await member();
  if (!user) return { ok: false, error: NOT_ALLOWED };

  // RLS limits this to the deal's creator or the owner. If it hides the row,
  // roll back so a venue added for this edit isn't kept either.
  const result = await attempt(user, 'Couldn’t save your changes. Try again.', async (tx) => {
    const venueId = await queries.resolveVenue(tx, input.value.venue);
    const deal = await queries.updateDeal(tx, id, dealColumns(input.value, venueId));
    if (!deal) throw new NotYours();
    return deal;
  });
  if (result instanceof NotYours) return { ok: false, error: 'You can only edit deals you added.' };
  return 'error' in result ? { ok: false, error: result.error } : { ok: true, deal: result };
}

export async function deleteDeal(id: unknown): Promise<DeleteResult> {
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, error: 'Something went wrong. Try again.' };
  const user = await member();
  if (!user) return { ok: false, error: NOT_ALLOWED };

  const result = await attempt(user, 'Couldn’t delete the deal. Try again.', async (tx) => {
    if (!(await queries.deleteDeal(tx, id))) throw new NotYours();
  });
  if (result instanceof NotYours) return { ok: false, error: 'You can only delete deals you added.' };
  return result === undefined ? { ok: true } : { ok: false, error: result.error };
}
