// Checks the deployed Neon database, not PGlite: the app's queries as
// mates_app over the pooled URL, with RLS. Skipped unless NEON_LIVE=1.
//   NEON_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/db/neon.live.test.ts
// It adds two test emails and their rows, then deletes them.

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as q from './queries';
import { inUserTransaction, type Queryable, type RequestUser } from './queryable';

const live = process.env.NEON_LIVE === '1';
const MEMBER: RequestUser = { id: 'live-test-member', email: 'live-test-member@example.com' };
const OTHER: RequestUser = { id: 'live-test-other', email: 'live-test-other@example.com' };
const STRANGER: RequestUser = { id: 'live-test-stranger', email: 'live-test-stranger@example.com' };

describe.skipIf(!live)('live Neon database', { timeout: 30_000 }, () => {
  let app: pg.Pool;
  let owner: pg.Client;

  function as<T>(user: RequestUser | null, fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return (async () => {
      const client = await app.connect();
      try {
        const db: Queryable = {
          async query<R>(text: string, params?: unknown[]) {
            return { rows: (await client.query(text, params)).rows as R[] };
          },
        };
        return await inUserTransaction(db, user, fn);
      } finally {
        client.release();
      }
    })();
  }

  async function cleanUp() {
    const ids = [MEMBER.id, OTHER.id];
    await owner.query('delete from public.deals where created_by = any($1)', [ids]);
    await owner.query('delete from public.venues where created_by = any($1)', [ids]);
    await owner.query('delete from public.profiles where id = any($1)', [ids]);
    await owner.query('delete from public.allowed_emails where email = any($1)', [[MEMBER.email, OTHER.email]]);
  }

  beforeAll(async () => {
    app = new pg.Pool({ connectionString: process.env.MATES_APP_DATABASE_URL, max: 2 });
    owner = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
    await owner.connect();
    await cleanUp();
    await owner.query("insert into public.allowed_emails (email) values ($1), ($2)", [MEMBER.email, OTHER.email]);
  });

  afterAll(async () => {
    await cleanUp();
    await owner.end();
    await app.end();
  });

  it('connects as mates_app, which can’t bypass RLS', async () => {
    const { rows } = await app.query<{ current_user: string; rolbypassrls: boolean }>(
      'select current_user, rolbypassrls from pg_roles where rolname = current_user',
    );
    expect(rows[0]).toEqual({ current_user: 'mates_app', rolbypassrls: false });
  });

  it('lets a member add a venue and deal, and read them back', async () => {
    await as(MEMBER, (tx) => q.upsertProfile(tx, { displayName: 'Live Test', avatarUrl: null }));
    await as(OTHER, (tx) => q.upsertProfile(tx, { displayName: 'Other', avatarUrl: null }));
    expect(await as(MEMBER, q.crewRole)).toBe('member');

    const deal = await as(MEMBER, async (tx) => {
      const venueId = await q.resolveVenue(tx, {
        kind: 'pin',
        name: 'Live test venue',
        suburb: null,
        lat: -37.8,
        lng: 144.96,
      });
      return q.insertDeal(tx, {
        venue_id: venueId,
        title: 'Live test parma',
        price_cents: 1500,
        category: 'food',
        tags: ['parma'],
        days: [2],
        start_time: '17:00',
        end_time: null,
        valid_from: null,
        valid_until: null,
        notes: null,
      });
    });
    expect(deal).toMatchObject({ title: 'Live test parma', start_time: '17:00:00', creator: { display_name: 'Live Test' } });

    const seen = await as(OTHER, q.listDeals);
    expect(seen.some((d) => d.id === deal.id)).toBe(true);
    expect(await as(OTHER, (tx) => q.deleteDeal(tx, deal.id))).toBe(false);
    expect(await as(MEMBER, (tx) => q.deleteDeal(tx, deal.id))).toBe(true);
  });

  it('shows a stranger nothing', async () => {
    expect(await as(STRANGER, q.crewRole)).toBeNull();
    expect(await as(STRANGER, q.listDeals)).toEqual([]);
    expect(await as(STRANGER, q.listVenues)).toEqual([]);
  });

  it('answers the sign-up gate check', async () => {
    expect(await as(null, (tx) => q.isAllowedSignup(tx, MEMBER.email))).toBe(true);
    expect(await as(null, (tx) => q.isAllowedSignup(tx, STRANGER.email))).toBe(false);
  });
});
