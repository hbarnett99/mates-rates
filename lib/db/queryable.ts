/**
 * The one method the app needs from a Postgres connection. The Neon driver's
 * Client and PGlite (used in the tests) both satisfy it.
 */
export type Queryable = {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

/** Who the queries run as. Both come from the verified Neon Auth session. */
export type RequestUser = { id: string; email: string };

/**
 * Runs fn in a transaction as mates_app with the user's id and email set, so
 * the RLS policies in db/migrations/0001_init.sql apply. The connection must
 * already be logged in as mates_app (or allowed to `set role` to it, as in
 * the tests).
 */
export async function inUserTransaction<T>(
  db: Queryable,
  user: RequestUser | null,
  fn: (tx: Queryable) => Promise<T>,
  { setRole = false }: { setRole?: boolean } = {},
): Promise<T> {
  await db.query('begin');
  try {
    if (setRole) await db.query('set local role mates_app');
    await db.query("select set_config('app.user_id', $1, true), set_config('app.email', $2, true)", [
      user?.id ?? '',
      user?.email ?? '',
    ]);
    const result = await fn(db);
    await db.query('commit');
    return result;
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}
