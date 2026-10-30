// Every query the app runs. Each takes a Queryable already inside
// inUserTransaction, so RLS applies. Rows come back as JSON so dates and
// times stay strings (see lib/db/types.ts).

import type { Deal } from '@/lib/deals/types';
import type { VenueInput } from '@/lib/deals/input';
import type { Queryable } from './queryable';
import type { CrewRole, DealWrite, VenueRow } from './types';

/** A deal joined to its venue and who added it, as one JSON object. */
const DEAL_JSON = `
  to_jsonb(d) || jsonb_build_object(
    'venue', to_jsonb(v),
    'creator', case when p.id is null then null else jsonb_build_object('display_name', p.display_name) end
  )`;

const DEAL_FROM = `
  public.deals d
  join public.venues v on v.id = d.venue_id
  left join public.profiles p on p.id = d.created_by`;

/** The signed-in user's crew role, or null if they're not on the allowlist. */
export async function crewRole(tx: Queryable): Promise<CrewRole | null> {
  const { rows } = await tx.query<{ role: CrewRole }>(
    'select role from public.allowed_emails where email = public.current_email()',
  );
  return rows[0]?.role ?? null;
}

/** For the sign-up webhook: is this email on the allowlist? */
export async function isAllowedSignup(tx: Queryable, email: string): Promise<boolean> {
  const { rows } = await tx.query<{ allowed: boolean }>('select public.is_allowed_signup($1) as allowed', [email]);
  return rows[0]?.allowed === true;
}

export async function upsertProfile(
  tx: Queryable,
  profile: { displayName: string | null; avatarUrl: string | null },
): Promise<void> {
  await tx.query('select public.upsert_profile($1, $2)', [profile.displayName, profile.avatarUrl]);
}

export async function listDeals(tx: Queryable): Promise<Deal[]> {
  const { rows } = await tx.query<{ deal: Deal }>(`select ${DEAL_JSON} as deal from ${DEAL_FROM}`);
  return rows.map((r) => r.deal);
}

export async function listVenues(tx: Queryable): Promise<VenueRow[]> {
  const { rows } = await tx.query<{ venue: VenueRow }>('select to_jsonb(v) as venue from public.venues v order by v.name');
  return rows.map((r) => r.venue);
}

async function dealById(tx: Queryable, id: string): Promise<Deal | null> {
  const { rows } = await tx.query<{ deal: Deal }>(`select ${DEAL_JSON} as deal from ${DEAL_FROM} where d.id = $1`, [id]);
  return rows[0]?.deal ?? null;
}

/** The venue id for a form choice, adding the venue if it's new to the app. */
export async function resolveVenue(tx: Queryable, venue: VenueInput): Promise<string> {
  if (venue.kind === 'existing') return venue.id;

  if (venue.kind === 'place') {
    // do nothing on conflict: another mate may have added the same place.
    const inserted = await tx.query<{ id: string }>(
      `insert into public.venues (name, suburb, lat, lng, google_place_id, location_refreshed_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (google_place_id) do nothing
       returning id`,
      [venue.name, venue.suburb, venue.lat, venue.lng, venue.googlePlaceId],
    );
    if (inserted.rows[0]) return inserted.rows[0].id;
    const existing = await tx.query<{ id: string }>('select id from public.venues where google_place_id = $1', [
      venue.googlePlaceId,
    ]);
    if (!existing.rows[0]) throw new Error('Venue vanished after a conflicting insert');
    return existing.rows[0].id;
  }

  const inserted = await tx.query<{ id: string }>(
    'insert into public.venues (name, suburb, lat, lng) values ($1, $2, $3, $4) returning id',
    [venue.name, venue.suburb, venue.lat, venue.lng],
  );
  const row = inserted.rows[0];
  if (!row) throw new Error('Venue insert returned no row');
  return row.id;
}

function dealParams(deal: DealWrite): unknown[] {
  return [
    deal.venue_id,
    deal.title,
    deal.price_cents,
    deal.category,
    deal.tags,
    deal.days,
    deal.start_time,
    deal.end_time,
    deal.valid_from,
    deal.valid_until,
    deal.notes,
  ];
}

export async function insertDeal(tx: Queryable, deal: DealWrite): Promise<Deal> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.deals
       (venue_id, title, price_cents, category, tags, days, start_time, end_time, valid_from, valid_until, notes)
     values ($1, $2, $3, $4, $5::text[], $6::smallint[], $7, $8, $9, $10, $11)
     returning id`,
    dealParams(deal),
  );
  const inserted = rows[0] ? await dealById(tx, rows[0].id) : null;
  if (!inserted) throw new Error('Deal insert returned no row');
  return inserted;
}

/**
 * Updates a deal. Returns null when RLS hides the
 * row: it doesn't exist, or the user isn't its creator or the owner.
 */
export async function updateDeal(tx: Queryable, id: string, deal: DealWrite): Promise<Deal | null> {
  const { rows } = await tx.query<{ id: string }>(
    `update public.deals set
       venue_id = $2, title = $3, price_cents = $4, category = $5, tags = $6::text[], days = $7::smallint[],
       start_time = $8, end_time = $9, valid_from = $10, valid_until = $11, notes = $12
     where id = $1
     returning id`,
    [id, ...dealParams(deal)],
  );
  return rows[0] ? dealById(tx, rows[0].id) : null;
}

/** Deletes a deal. False when RLS hides it, as for updateDeal. */
export async function deleteDeal(tx: Queryable, id: string): Promise<boolean> {
  const { rows } = await tx.query<{ id: string }>('delete from public.deals where id = $1 returning id', [id]);
  return rows.length > 0;
}

export async function venuesNeedingRefresh(
  tx: Queryable,
  { limit, olderThanDays }: { limit: number; olderThanDays: number },
): Promise<{ id: string; google_place_id: string }[]> {
  const { rows } = await tx.query<{ id: string; google_place_id: string }>(
    "select id, google_place_id from public.venues_needing_refresh($1, make_interval(days => $2))",
    [limit, olderThanDays],
  );
  return rows;
}

export async function setVenueLocation(tx: Queryable, id: string, location: { lat: number; lng: number }): Promise<void> {
  await tx.query('select public.set_venue_location($1, $2, $3)', [id, location.lat, location.lng]);
}
