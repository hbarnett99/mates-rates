import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';
import { inUserTransaction, type Queryable, type RequestUser } from './queryable';

let pool: Pool | undefined;

/**
 * One pool per function instance, as mates_app over Neon's pooled
 * connection. Created on first use so `next build` doesn't need the URL.
 * attachDatabasePool lets Vercel Fluid compute close idle clients before
 * the instance is suspended.
 */
function getPool(): Pool {
  if (!pool) {
    const url = process.env.MATES_APP_DATABASE_URL;
    if (!url) throw new Error('Missing environment variable MATES_APP_DATABASE_URL. See .env.example.');
    pool = new Pool({ connectionString: url, max: 5 });
    attachDatabasePool(pool);
  }
  return pool;
}

/**
 * Runs fn in one transaction as mates_app with the user's id and email set
 * for RLS. The settings are transaction-local, so they never leak to the
 * next request on a pooled connection.
 */
export async function withUser<T>(user: RequestUser | null, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const db: Queryable = {
    async query<R>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return { rows: result.rows as R[] };
    },
  };
  try {
    return await inUserTransaction(db, user, fn);
  } finally {
    client.release();
  }
}
