// Runs a migration file as the project owner over the direct connection.
//   node --env-file=.env.local scripts/migrate.mjs db/migrations/0001_init.sql
import { readFileSync } from 'node:fs';
import pg from 'pg';

const [file] = process.argv.slice(2);
const url = process.env.DATABASE_URL_UNPOOLED;
if (!file || !url) {
  console.error('Usage: node --env-file=.env.local scripts/migrate.mjs <file.sql> (needs DATABASE_URL_UNPOOLED)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('begin');
  await client.query(readFileSync(file, 'utf8'));
  await client.query('commit');
  console.log(`Applied ${file}`);
} catch (error) {
  await client.query('rollback');
  console.error(`Failed, rolled back: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
