// Runs db/migrations/0001_init.sql in PGlite (Postgres compiled to WASM) and
// checks the RLS policies through the same queries the app uses, as the
// mates_app role.

import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import type { VenueInput } from '@/lib/deals/input';
import * as q from './queries';
import { inUserTransaction, type Queryable, type RequestUser } from './queryable';
import type { DealWrite } from './types';

const OWNER: RequestUser = { id: 'user-owner', email: 'owner@example.com' };
const ALICE: RequestUser = { id: 'user-alice', email: 'alice@example.com' };
const BOB: RequestUser = { id: 'user-bob', email: 'bob@example.com' };
const STRANGER: RequestUser = { id: 'user-stranger', email: 'stranger@example.com' };

const PLACE: VenueInput = {
  kind: 'place',
  googlePlaceId: 'place-1',
  name: 'The Local',
  suburb: 'Fitzroy',
  lat: -37.8,
  lng: 144.98,
};

function dealWrite(venueId: string, overrides: Partial<DealWrite> = {}): DealWrite {
  return {
    venue_id: venueId,
    title: '$15 parma',
    price_cents: 1500,
    category: 'food',
    tags: ['parma'],
    days: [2],
    start_time: '17:00',
    end_time: null,
    valid_from: '2026-10-01',
    valid_until: null,
    notes: null,
    ...overrides,
  };
}

let db: PGlite;

/** Runs fn as mates_app for user, the way lib/db/index.ts does. */
function as<T>(user: RequestUser | null, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return inUserTransaction(db, user, fn, { setRole: true });
}

/** Runs sql as the table owner, bypassing RLS, like the Neon SQL editor. */
async function asOwnerRole(sql: string, params: unknown[] = []) {
  return db.query(sql, params);
}

/** A mate who has loaded the app once, so their profile exists. */
async function signIn(user: RequestUser, name: string) {
  await as(user, (tx) => q.upsertProfile(tx, { displayName: name, avatarUrl: null }));
}

let aliceDealId: string;
let venueId: string;

beforeAll(async () => {
  db = new PGlite();
  for (const file of ['0001_init.sql', '0002_signup_gate.sql']) {
    await db.exec(readFileSync(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await asOwnerRole(
    "insert into public.allowed_emails (email, role) values ('owner@example.com', 'owner'), ('alice@example.com', 'member'), ('bob@example.com', 'member')",
  );
  await signIn(OWNER, 'Owner');
  await signIn(ALICE, 'Alice');
  await signIn(BOB, 'Bob');

  const deal = await as(ALICE, async (tx) => q.insertDeal(tx, dealWrite(await q.resolveVenue(tx, PLACE))));
  aliceDealId = deal.id;
  venueId = deal.venue_id;
});

describe('members', () => {
  it('know their role', async () => {
    expect(await as(OWNER, q.crewRole)).toBe('owner');
    expect(await as(ALICE, q.crewRole)).toBe('member');
  });

  it('match the allowlist whatever the email case', async () => {
    expect(await as({ ...ALICE, email: 'Alice@Example.com' }, q.crewRole)).toBe('member');
  });

  it('read deals joined to venue and creator, with dates and times as strings', async () => {
    const deals = await as(BOB, q.listDeals);
    expect(deals).toHaveLength(1);
    const [deal] = deals;
    expect(deal).toMatchObject({
      id: aliceDealId,
      title: '$15 parma',
      price_cents: 1500,
      tags: ['parma'],
      days: [2],
      start_time: '17:00:00',
      end_time: null,
      valid_from: '2026-10-01',
      created_by: ALICE.id,
      venue: { id: venueId, name: 'The Local', google_place_id: 'place-1', created_by: ALICE.id },
      creator: { display_name: 'Alice' },
    });
    expect(typeof deal?.last_confirmed_at).toBe('string');
  });

  it('reuse a venue when the same Google place is added again', async () => {
    const again = await as(BOB, (tx) => q.resolveVenue(tx, PLACE));
    expect(again).toBe(venueId);
    expect(await as(BOB, q.listVenues)).toHaveLength(1);
  });

  it("can't update or delete another member's deal", async () => {
    expect(await as(BOB, (tx) => q.updateDeal(tx, aliceDealId, dealWrite(venueId, { title: 'hacked' })))).toBeNull();
    expect(await as(BOB, (tx) => q.deleteDeal(tx, aliceDealId))).toBe(false);
    const [deal] = await as(ALICE, q.listDeals);
    expect(deal?.title).toBe('$15 parma');
  });

  it("can't add a deal in someone else's name", async () => {
    await expect(
      as(BOB, (tx) =>
        tx.query(
          "insert into public.deals (venue_id, title, price_cents, category, days, created_by) values ($1, 'x', 0, 'food', '{1}', $2)",
          [venueId, ALICE.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("can't edit another member's venue directly", async () => {
    const { rows } = await as(BOB, (tx) => tx.query('update public.venues set name = $1 returning id', ['hacked']));
    expect(rows).toHaveLength(0);
  });

  it('can update their own deal, and the owner can update anyone’s', async () => {
    const mine = await as(ALICE, (tx) => q.updateDeal(tx, aliceDealId, dealWrite(venueId, { price_cents: 1400 })));
    expect(mine?.price_cents).toBe(1400);
    const owners = await as(OWNER, (tx) => q.updateDeal(tx, aliceDealId, dealWrite(venueId, { price_cents: 1300 })));
    expect(owners?.price_cents).toBe(1300);
    expect(owners?.created_by).toBe(ALICE.id);
  });

  it('can delete their own deal', async () => {
    const id = await as(BOB, async (tx) => (await q.insertDeal(tx, dealWrite(venueId, { title: 'Bob’s' }))).id);
    expect(await as(BOB, (tx) => q.deleteDeal(tx, id))).toBe(true);
  });

  it("can't change the allowlist or profiles", async () => {
    await expect(
      as(ALICE, (tx) => tx.query("insert into public.allowed_emails (email) values ('mate@example.com')")),
    ).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, (tx) => tx.query("update public.profiles set display_name = 'x'"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('people not on the list', () => {
  for (const [label, user] of [
    ['a stranger', STRANGER],
    ['no session', null],
  ] as const) {
    it(`${label} reads nothing`, async () => {
      expect(await as(user, q.crewRole)).toBeNull();
      expect(await as(user, q.listDeals)).toEqual([]);
      expect(await as(user, q.listVenues)).toEqual([]);
      const { rows } = await as(user, (tx) => tx.query('select * from public.allowed_emails'));
      expect(rows).toEqual([]);
    });

    it(`${label} can't add a venue, a deal or a profile`, async () => {
      await expect(as(user, (tx) => q.resolveVenue(tx, { ...PLACE, googlePlaceId: 'place-2' }))).rejects.toThrow();
      await expect(as(user, (tx) => q.insertDeal(tx, dealWrite(venueId)))).rejects.toThrow();
      await expect(as(user, (tx) => q.upsertProfile(tx, { displayName: 'x', avatarUrl: null }))).rejects.toThrow(
        /not a member/,
      );
    });
  }

  it('a removed mate is cut off straight away', async () => {
    await asOwnerRole("insert into public.allowed_emails (email) values ('temp@example.com')");
    const temp = { id: 'user-temp', email: 'temp@example.com' };
    expect(await as(temp, q.listDeals)).toHaveLength(1);
    await asOwnerRole("delete from public.allowed_emails where email = 'temp@example.com'");
    expect(await as(temp, q.listDeals)).toEqual([]);
  });
});

describe('the sign-up gate', () => {
  it('answers for one email without a user, and nothing more', async () => {
    expect(await as(null, (tx) => q.isAllowedSignup(tx, 'Alice@Example.com'))).toBe(true);
    expect(await as(null, (tx) => q.isAllowedSignup(tx, 'stranger@example.com'))).toBe(false);
    const { rows } = await as(null, (tx) => tx.query('select * from public.allowed_emails'));
    expect(rows).toEqual([]);
  });
});

describe('the venue refresh job', () => {
  it('finds venues with stale coordinates and updates them without a user', async () => {
    await asOwnerRole("update public.venues set location_refreshed_at = now() - interval '26 days'");
    const stale = await as(null, (tx) => q.venuesNeedingRefresh(tx, { limit: 50, olderThanDays: 25 }));
    expect(stale).toEqual([{ id: venueId, google_place_id: 'place-1' }]);

    await as(null, (tx) => q.setVenueLocation(tx, venueId, { lat: -37.81, lng: 144.97 }));
    const [venue] = await as(ALICE, q.listVenues);
    expect(venue).toMatchObject({ lat: -37.81, lng: 144.97 });
    expect(await as(null, (tx) => q.venuesNeedingRefresh(tx, { limit: 50, olderThanDays: 25 }))).toEqual([]);
  });
});

describe('constraints', () => {
  it('reject unknown tags, empty or invalid days, and bad date ranges', async () => {
    await expect(as(ALICE, (tx) => q.insertDeal(tx, dealWrite(venueId, { tags: ['nope'] })))).rejects.toThrow();
    await expect(as(ALICE, (tx) => q.insertDeal(tx, dealWrite(venueId, { days: [] })))).rejects.toThrow();
    await expect(as(ALICE, (tx) => q.insertDeal(tx, dealWrite(venueId, { days: [7] })))).rejects.toThrow();
    await expect(
      as(ALICE, (tx) =>
        q.insertDeal(tx, dealWrite(venueId, { valid_from: '2026-10-02', valid_until: '2026-10-01' })),
      ),
    ).rejects.toThrow();
  });

  it('reject an allowlist email that isn’t lower case', async () => {
    await expect(asOwnerRole("insert into public.allowed_emails (email) values ('Mate@example.com')")).rejects.toThrow();
  });
});
