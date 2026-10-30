# Mates Rates

The crew's food and drink deals, on a map. The full spec is in [docs/plan.md](docs/plan.md). The database and sign-in run on Neon (Postgres plus Neon Auth) rather than the Supabase setup the spec describes. The Neon project is linked in `.neon` and declared in `neon.ts`.

## Setup

Already done on the `production` branch:
- `neon deploy` has provisioned Postgres and Neon Auth.
- Both migrations have run.
- `mates_app` has a password.
- Google sign-in is on, using Neon's shared development credentials.
- Email and password sign-in is off.
- The owner email is on the allowlist.

For a fresh branch or project:

1. **Provision.** Run `neon deploy`. It writes the Neon variables to `.env.local`.
2. **Migrations.** Run each file in `db/migrations` in order:
   ```sh
   node --env-file=.env.local scripts/migrate.mjs db/migrations/0001_init.sql
   ```
3. **App password.** Give `mates_app` one in the Neon SQL editor:
   ```sql
   alter role mates_app with login password '<openssl rand -base64 32>';
   ```
   Put the pooled URL with that role in `MATES_APP_DATABASE_URL`. The app never uses the owner URLs, because the owner bypasses RLS.
4. **Cookie secret.** Set `NEON_AUTH_COOKIE_SECRET` to at least 32 random characters. Copy the other names from `.env.example`.
5. **Email/password off.** Run `neon neon-auth config email-password update --enabled=false`. Only Google should be on.

```sh
npm install
npm run dev        # http://localhost:3000
```

## Before going live on Vercel

1. **Environment variables.** Add every variable from `.env.example` to the Vercel project except `DATABASE_URL_UNPOOLED`. Functions run in `sin1` (`vercel.json`), next to the Neon database in `ap-southeast-1`.
2. **Your own Google OAuth client.** The shared credentials show Neon's branding and are for development only. Set the client's redirect URI to `<NEON_AUTH_BASE_URL>/callback/google`, then run `neon neon-auth oauth-provider` to switch to it.
3. **Trusted domain.** Run `neon neon-auth domain add https://<your-app>.vercel.app`.
4. **Sign-up gate.** Neon can't call localhost, so this only works once the app is deployed:
   ```sh
   neon neon-auth config webhook update --enabled --url https://<your-app>.vercel.app/api/auth-webhooks/before-create --enabled-events user.before_create
   ```
   After that, only allowlisted Google emails can create an account. Check it straight away by signing in with your own account. The webhook fails closed, so a wrong URL blocks every sign-up.

## Checks

```sh
npm test           # unit tests, plus the migrations and RLS policies run in PGlite
npm run typecheck
npm run build
# The deployed database: the app's queries as mates_app, with RLS. Adds and removes its own test rows.
NEON_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/db/neon.live.test.ts
```

## Adding a mate

Add their Google email (lower case) to `allowed_emails` with role `member`, in Neon's Tables view or the SQL editor.

To remove someone, delete their row. From their next request they see nothing, and they can't add or change anything. Their deals stay, credited to them. If you also delete their `profiles` row, the deals stay credited to "a former mate". Remove their account with `neon neon-auth user delete <id>`.
