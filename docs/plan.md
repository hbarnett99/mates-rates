# Mates Rates — Web App Spec

Oct 22, 2026 · @Henry Barnett

## Overview

Mates Rates is a private web app where a small crew of mates logs recurring food and drink deals ("$35 Sunday roast", "$28 chicken Wednesday") and sees what's on for any date as pins on a map.

**Goals**

- Anyone in the crew can add a deal from their phone in under 30 seconds.
- Pick a date and the map shows only venues with a deal running that day.
- Same experience on phone and desktop, dark theme throughout.
- Runs at $0/month on free tiers.

**Non-goals for v1**

- Public sign-ups or a public deal directory.
- Scraping deals from other sites.
- Bookings, reviews, ratings or comments.
- Native iOS/Android apps (the web app is installable to the home screen instead).

## Users and access

Sign-in is Google only, through Supabase Auth, and only emails you've added to the allowlist by hand ever get an account.

- **Sign-in:** one "Continue with Google" button, using a Google Cloud OAuth client with Supabase's callback URL as the redirect.
- **Allowlist:** an `allowed_emails` table (email + role) that you fill in by hand in the Supabase Table Editor. No admin screen in the app.
- **Lock-out at sign-up:** a "before user created" auth hook, written as a Postgres function, rejects any Google account whose email isn't in the table, so the user is never created ([Supabase docs](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)). The function needs `execute` granted to `supabase_auth_admin` and read access to `allowed_emails`.
- **Error screen:** Supabase can surface the hook's rejection as a generic error ([reported issue](https://github.com/supabase/auth/issues/2235)), so the app shows its own "You're not on the list" screen whenever sign-in fails.
- **Lock-out for data:** row-level security on every table also checks the allowlist. This matters when you remove someone later: the hook only runs for new accounts, so RLS is what cuts off an existing mate. Delete their user under Authentication > Users to tidy up.
- **Roles:** `owner` (you: edit or delete anything) and `member` (adds deals, edits or deletes their own), set in the same table.
- **Session:** stays signed in on each device until sign-out.

## Core features and user flows

The app is one screen: a map of deals for the selected date, with a list alongside. Items marked *(later)* are outside the MVP.

**Date selector**

- A row of chips: Today, Tomorrow, then the next five days by name ("Sat 24", "Sun 25"). A calendar icon opens a full date picker for anything further out.
- Changing the date updates pins and list instantly. Filtering runs on the device, with no network call.
- "Today" means today in Melbourne time (`Australia/Melbourne`), not the device's time zone.
- A deal shows on a date when the weekday matches one of its days and the date is inside its optional valid-from / valid-until range.

**Map**

- Full-screen dark map centred on Melbourne, with a "locate me" button.
- Each venue with a deal that day gets a pin labelled with its lowest price ("$35"). Pin colour shows the category: food, drink, or both.
- Pins merge into a count bubble when zoomed out; tapping one zooms in.
- Tapping a pin opens a deal card: venue, deal title, price, time window, days it runs, notes, who added it, when it was last confirmed, and a Directions button that opens the phone's maps app.

**List**

- **Phone:** a Map / List toggle at the top. List view is a full-screen scrollable list; on the map, a bottom sheet still gives a quick peek.
- **Desktop:** the left panel is the list, scrolling independently of the map.
- Each row shows venue, deal title, price, tags, time window and distance. A venue with several deals that day groups them under one heading.
- Sorted by distance (if location is shared) or price.
- Selecting a row flies the map to its pin (switching to the map on phone); tapping a pin scrolls the list to its row.
- The list for the chosen date is server-rendered, so it shows before the map has finished loading.
- Filters by tag (steak, Asian, happy hour), food or drink, and max price. *(later)*

**Add a deal** (target: under 30 seconds on a phone)

1. Tap "+ Add deal".
2. Type the venue name ("Corner Hotel"). Results appear as you type, biased to the visible map area. If the venue is already in the app it's offered first; if search can't find it, drop a pin by hand.
3. Fill in title ("Parma + pot"), price, days (tap M T W T F S S), optional time window, category, optional notes.
4. Save. The pin appears straight away, before the server confirms.

**Keeping deals accurate**

- Members edit or delete their own deals; the owner can edit any.
- A "Still on?" button lets any member confirm a deal is current, updating its last-confirmed date. Deals unconfirmed for 90 days show a faded pin and a "may be outdated" tag. *(later)*
- Changes made by one mate appear for others without a refresh. *(later)*

**Installable**

- Works as a PWA: "Add to Home Screen" on Android and iPhone opens it full-screen like an app.

## Share to app and auto-tagging

Share an Instagram link and the server reads the post, has AI pull out the venue, deal, days and price, and pre-fills the form, all on free tiers. The read goes through Apify's scraper, because Instagram blocks direct requests from servers; a screenshot is the fallback when that fails.

| Ask | Free? | How |
| --- | --- | --- |
| Auto tags (steak, Asian, happy hour) | Yes | Keyword rules on every save; AI picks tags on imports |
| Link the venue's Instagram | Yes | The post's @username comes back with the scrape |
| Share an Instagram link and have it auto-filled | Yes, inside Apify's $5 monthly free credit | Apify reads the post; Gemini turns caption and image into a draft deal |
| Share from iPhone | No share-sheet entry | Paste the link into the app instead |

**How the server reads a link**

- Your own server can't just fetch the post. Instagram pre-blocks cloud IP ranges like AWS, which Vercel runs on, and often answers with an empty page rather than an error ([scraper notes](https://github.com/ChocoData-com/instagram-scraper)). Meta's official oEmbed route needs [App Review](https://developers.facebook.com/documentation/development/features-reference/oembed-read) and business verification.
- Apify's Instagram Scraper does the read instead. Its free plan includes $5 of credit a month, and posts cost about $2.70 per 1,000 on that plan ([pricing guide](https://www.xpoz.ai/blog/guides/instagram-api-pricing-2026/)), so a crew sharing a few posts a week pays nothing.
- It returns the caption, the poster's @username, the location tag when there is one, and the image.
- Scraping breaks whenever Instagram changes its pages, and it's against Instagram's terms; Apify carries that, but expect the odd failure. Fine for a private app, not something to build a business on.
- Posts and reels work. Stories expire, so screenshot those.
- iPhones can't add web apps to the share sheet: Safari doesn't support the Web Share Target API ([web.dev](https://web.dev/learn/pwa/os-integration)). iPhone mates paste the link instead.

**Share flow (Android)**

1. In Instagram, tap Share on the post and pick the app (Android), or copy the link and paste it into the app's "Add from Instagram" box (iPhone).
2. The app shows a "Reading deal…" screen and sends the link to a server route.
3. The server runs Apify's scraper on the link and gets the caption, @username, location and image.
4. The server sends caption and image to Gemini with a fixed JSON schema: venue name, suburb, and one or more deals (title, price, days, times, tags from the app's list). The image matters, because prices and days are often only on the poster.
5. The app matches the venue (existing venues first, then a Google Places search on the name and location tag), saves the @username as the venue's Instagram, pre-fills the form and highlights fields it isn't sure about.
6. You check it and tap Save. Nothing is saved without a person confirming.
7. If the scrape fails, the app asks for a screenshot and runs the same Gemini step on it.

Expect a short wait while Apify spins up its scraper, so the progress screen shows each step. Images go straight to Gemini and are never stored; the post link is saved as the deal's source.

**The review form**

- It's the normal add-deal form, opened with the AI's answers already filled in. Every field stays editable.
- Fields the AI wasn't sure about get an amber outline. Anything the post doesn't state stays empty: the schema allows null, and the prompt says never to guess.
- The venue shows its best match with a "Change" button to pick another or drop a pin.
- A post with several deals (Tuesday steak, Wednesday parma) opens as one card per deal; untick any you don't want.
- Tags arrive as pre-selected chips you can tap off or add to.
- A link to the original post sits at the top for checking. Nothing saves until you tap Save; Cancel discards it all.

**Free AI: Gemini API free tier**

- Flash models are free at about 15 requests a minute and 1,500 a day ([summary of Google's limits](https://pasqualepillitteri.it/en/news/6683/gemini-2-5-flash-free-1m-tokens)). A crew importing a few posts a week uses a tiny fraction.
- On the free tier Google may use inputs and outputs to improve its models, and human reviewers may read them ([pricing guide](https://geotoolbox.ai/blog/gemini-api-pricing.md)). Fine for public Instagram posts; never send anything private.
- Limits change without notice; Google cut them in [December 2025](https://blog.laozhang.ai/en/posts/gemini-api-free-tier). If quota runs out, the manual form still works.
- The API key lives only on the server; the browser never sees it.
- The model name is an env var, so swapping to whichever Flash or Flash-Lite model is current needs no code change.

**Tags**

- One fixed list keeps filters tidy: steak, parma, roast, burger, pizza, wings, Mexican, Asian, Indian, Italian, seafood, brunch, lunch special, happy hour, pints, cocktails, wine, trivia, kids eat free.
- Keyword rules run on every save, over title and notes: "parma" or "parmi" adds parma; "ramen", "pho", "dumpling", "bao", "sushi" or "laksa" adds Asian. Free, instant, and enough for most deals.
- AI imports can only pick from the same list, because the schema enforces it. Anyone can add or remove tags by hand.

**Venue Instagram link**

- Each venue stores an `instagram_handle`; the deal card shows an Instagram button.
- Filled automatically from the post's @username on import, otherwise pasted by hand.

## Data model

Five Postgres tables in `public`, all with row-level security on. New Supabase projects no longer expose `public` tables to the Data API automatically, so every table the app reads needs an explicit `GRANT` in the migration ([Supabase changelog](https://supabase.com/changelog?tags=mcp)).

| Table | Key columns | Purpose |
| --- | --- | --- |
| `allowed_emails` | `email` (pk), `role` (owner / member), `added_at` | The crew allowlist |
| `profiles` | `id` (= auth user id), `display_name`, `avatar_url` | Filled from Google on first sign-in by a trigger |
| `venues` | `id`, `name`, `suburb`, `google_place_id`, `lat`, `lng`, `location_refreshed_at`, `instagram_handle`, `created_by` | One row per pub or restaurant; `google_place_id` stops duplicates; coordinates refreshed inside Google's 30-day limit |
| `deals` | `id`, `venue_id`, `title`, `price_cents`, `category`, `tags` (text\[\]), `days` (smallint\[\]), `start_time`, `end_time`, `valid_from`, `valid_until`, `notes`, `source_url`, `last_confirmed_at`, `created_by`, `updated_at` | A venue can have many deals; `source_url` holds a shared Instagram link |
| `heartbeats` | `id`, `pinged_at` | Written only by the keep-alive job |

**Recurrence rule**

- `days` holds weekdays, 0 = Sunday to 6 = Saturday.
- A deal is on for date D when D's weekday (in `Australia/Melbourne`) is in `days` and `valid_from ≤ D ≤ valid_until`. Nulls mean open-ended.
- A one-off deal sets `valid_from` and `valid_until` to the same date.
- Prices are stored as whole cents (`3500`), never floats.

**Access rules**

- `is_member()`: a `security definer` function that checks `lower(auth.jwt() ->> 'email')` against `allowed_emails`. `is_owner()` does the same for the owner role.
- `venues`, `deals`: members can read and insert; update and delete only where `created_by = auth.uid()` or `is_owner()`.
- `allowed_emails`: members can read it; you edit it in the Supabase dashboard, never from the app.
- `heartbeats`: no grants to `anon` or `authenticated`; only the server-side keep-alive route touches it, using the secret key.
- Nothing is granted to `anon` at all.

```sql
grant select, insert, update, delete on public.venues, public.deals to authenticated;
grant select on public.profiles, public.allowed_emails to authenticated;

create policy "members read deals" on public.deals
  for select to authenticated using (public.is_member());
```

**Fetching**

- On load, fetch all deals joined to venues in one query. A crew will have tens to a few hundred rows, so this is small.
- Date filtering then happens in the browser, which is what makes switching dates instant.

## Tech stack and hosting

Mates Rates is Next.js 16 with server rendering, hosted on Vercel's free Hobby plan, with maps and venue search from Google Maps Platform. Supabase runs the database, sign-in and realtime but doesn't host the site itself.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript | Server-rendered list, API routes and auth in one project |
| Rendering | Server Components for pages; the map as a client-only component | List arrives in the first HTML; the map only runs in the browser |
| Auth plumbing | `@supabase/ssr` cookies, refreshed in `proxy.ts` | Same session on server and client |
| Writes | Server Actions with React's `useOptimistic` | Pins appear before the server confirms |
| Installable app | `manifest.webmanifest` with a share target, plus a small hand-written service worker | Home-screen install, Android share sheet, cached repeat visits |
| Map | Google Maps JavaScript API via [@vis.gl/react-google-maps](https://www.npmjs.com/package/@vis.gl/react-google-maps), vector map with a Map ID and `colorScheme` dark | Smooth WebGL map with Google's own dark styling |
| Pins | Advanced Markers with price labels, grouped by [@googlemaps/markerclusterer](https://developers.google.com/maps/articles/toomanymarkers) | Custom pins; only a few dozen on screen at once |
| Venue search | Places API (New): Autocomplete while typing, Text Search for AI imports | Finds Melbourne venues that OpenStreetMap missed |
| Instagram reading | Apify Instagram Scraper, called from a server route | Reads a shared post link; Instagram blocks direct server requests |
| AI extraction | Gemini API free tier (Flash), called from a server route | Turns caption and poster image into a draft deal |
| Web hosting | [Vercel Hobby](https://zplatform.ai/guides/is-vercel-free/) | $0 with no expiry, for non-commercial use; runs SSR, API routes and the daily cron |
| Backend | Supabase Free: Postgres, Auth (Google), Realtime | One service for data, login and live updates |
| Styling | Tailwind CSS with dark colour tokens | Fast to keep one consistent dark theme |

&#91;embedded content: architecture · 6 parts, all on free tiers\]

Vercel renders each page on the server, reading Supabase as the signed-in user, and runs the AI and keep-alive routes. After that, the browser talks to Supabase and Google Maps directly.

**How SSR is used:** the date lives in the URL (`/?date=2026-10-24`), so the server renders that day's list straight into the first HTML response, already filtered by the signed-in user's permissions. The map then loads in the browser with `dynamic(..., { ssr: false })`. After load, switching dates filters on the device and updates the URL with `history.replaceState`, so it never waits on the server.

**Auth guard:** Next.js 16 replaced `middleware.ts` with `proxy.ts` ([Next.js 16 notes](https://makerkit.dev/blog/md/tutorials/nextjs-16)). Use it to refresh the session and redirect signed-out visitors, but also check the user in the server layout: proxy bypass bugs were patched as recently as 16.2.6 (May 2026). Start on the current stable release, 16.2.6 or newer, and RLS remains the final lock either way.

**Why Google, not Apple:** Apple's MapKit JS needs an Apple Developer Program membership, about US$99 a year ([Apple developer forums](https://developer.apple.com/forums/thread/729746)), which breaks the $0 goal. Google's free monthly caps cover a crew many times over.

**Google rules that shape the build:**

- Place IDs can be stored indefinitely, but coordinates from Places only for 30 days ([Google terms](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522)). Venues store `google_place_id`, and the daily cron refreshes coordinates older than 25 days.
- Google requires a billing account with a card. Daily quotas on each API stop usage at the free caps, so it can't bill by surprise.
- Places results must sit on a Google map, which they now do.

## Keep-alive

A daily Vercel scheduled job writes a row to the database, so the free Supabase project never reaches its 7-day inactivity pause.

- **The risk:** free Supabase projects pause after one week of inactivity and stay down until someone restores them from the dashboard ([Neon's comparison, citing Supabase pricing](https://neon.com/guides/neon-vs-supabase-free-plan)).
- **What counts as activity:** Supabase looks at database activity over the week, not a fixed request count ([IT Path summary](https://www.itpathsolutions.com/supabase-free-tier-limits)). So the ping runs a real insert, not just a hit on the API URL.
- **Schedule:** a `crons` entry in `vercel.json` calling `/api/keep-alive` with `0 17 * * *` (daily at 17:00 UTC, early morning in Melbourne). Daily is the most often Vercel Hobby allows, and it fires somewhere within that hour ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). That still gives seven tries per pause window.
- **The route:**
  1. Rejects any request without `Authorization: Bearer <CRON_SECRET>`.
  2. Inserts a row into `heartbeats` using the Supabase secret key (server-only env var, never sent to the browser).
  3. Deletes heartbeats older than 30 days, and refreshes coordinates for venues last refreshed more than 25 days ago (Place Details, location field only).
  4. Returns 200 with the timestamp, or 500 so the failure shows in Vercel logs.
- **Grant:** `grant insert, delete on public.heartbeats to service_role;` (same explicit-grant rule as the other tables).
- **Why not GitHub Actions:** in a public repo, scheduled workflows are switched off automatically after 60 days with no repo activity ([GitHub docs](https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow)). That's exactly when a finished side project goes quiet.
- **Safety net:** Supabase emails before it pauses a project ([write-up](https://dev.to/astraedus/my-production-app-was-down-for-24-hours-and-nobody-told-me-3nma)). If that email ever arrives, the cron has broken. Normal use by the crew also counts as activity; the job covers quiet weeks.

## UI and UX

Dark-only and map-first. "Smooth" is defined by the measurable targets below, so it can be tested rather than argued about.

**Layouts**

| Element | Phone and tablet (< 1024 px) | Desktop (≥ 1024 px) |
| --- | --- | --- |
| Map | Full screen | Fills the right side |
| Date chips | Pinned to the top, scroll sideways | Top of the left panel |
| Deal list | Map / List toggle: full-screen scrollable list, or a bottom sheet over the map with three snap points (peek, half, full) | Left panel, 380 px wide, always visible |
| Add deal | Floating "+" button, opens a full-screen sheet | Button in the panel header, opens a side drawer |
| Deal card | Slides up from the bottom | Popup anchored to the pin |

**Smoothness targets**

- Switching date updates pins and list in under 100 ms (filtering on the device, no network).
- Pan and zoom hold 60 fps on a mid-range phone. The map uses Google's vector (WebGL) renderer, and pins cluster with MarkerClusterer so only a few dozen markers are on screen at once.
- Pins fade in and out over about 150 ms instead of popping.
- Selecting a deal flies the map to its pin over about 600 ms.
- Saves are optimistic: the pin appears at once; if the save fails it's removed and a toast explains why.
- Skeleton placeholders instead of spinners; the map shell paints before data arrives.
- First visit is usable within about 3 seconds on 4G. Repeat visits open from the service-worker cache and refresh in the background.
- `prefers-reduced-motion` turns animations into instant changes.
- Tap targets are at least 44 px.

**Dark theme**

- Dark only for v1; no light-mode toggle.
- Base map: Google Maps in its dark colour scheme, with business points of interest hidden so the crew's pins stand out.
- Colour tokens: background `#0E1013`, surface `#171A20`, raised `#20242C`, text `#E7E9EE`, muted text `#9AA1AD`, accent amber `#F5A524`.
- Pin colours: food amber `#F5A524`, drink teal `#2DD4BF`, both violet `#A78BFA`, each with dark label text. All text meets WCAG AA contrast.
- The browser `theme-color` matches the background, so the phone's status bar blends in.

## Build phases

Ship the MVP, use it for a month, and only build Phase 2 if the crew is actually opening it weekly. As a rough guide, the MVP is about 2–3 weekends for someone comfortable with Next.js and Supabase; budget double if learning either.

**Phase 1: MVP**

- [ ] Supabase project, Google Cloud project (OAuth client, Maps and Places keys, quota caps), and one migration with tables, grants, RLS policies and the sign-up hook
- [ ] Next.js app with Google sign-in, session refresh in `proxy.ts`, and a "not on the list" screen
- [ ] Dark map with clustered pins from the deals table
- [ ] Date chips plus date picker; date in the URL, list server-rendered
- [ ] Scrollable list view: Map / List toggle on phone, side panel on desktop
- [ ] Add, edit and delete a deal, with venue search and manual pin drop
- [ ] Keyword auto-tags on save
- [ ] Keep-alive route and daily Vercel cron
- [ ] Deploy to Vercel with a web manifest

Done when three mates have added 10 or more real deals from their phones, and the project has stayed up for two weeks without anyone touching it.

**Phase 2: polish**

- [ ] Share to app: Android share target, Apify read of the link, Gemini extraction, pre-filled form, paste box for iPhone, screenshot fallback
- [ ] Venue Instagram button
- [ ] Live updates when a mate adds or edits a deal
- [ ] "Still on?" confirmations and faded pins for stale deals
- [ ] Tag, food / drink and max-price filters
- [ ] Share link to a single deal

Share-to-app alone is roughly another weekend or two, mostly the service worker and tuning the extraction prompt on real posts.

**Phase 3: only if it sticks**

- [ ] Skip deals on Victorian public holidays
- [ ] "What's on tonight" push notification
- [ ] Multiple crews

## Build brief for Claude Code

Build Phase 1 only, in the checklist order above, and stop for review after each item. The dashboard setup below is done by hand, because a coding agent can't click through these consoles.

**Setup you do by hand**

- [ ] Supabase: create the project in the Sydney region; copy the URL, publishable key and secret key.
- [ ] Google Cloud: OAuth consent screen (External, email and profile scopes only, published) and an OAuth web client whose redirect URI is the Supabase callback URL.
- [ ] Google Cloud: enable Maps JavaScript API and Places API (New). Create a browser key restricted to the Vercel and `localhost` URLs, and a server key restricted to Places API (New) for the coordinate refresh.
- [ ] Google Cloud: create a vector Map ID with a dark style that hides business points of interest.
- [ ] Google Cloud: cap each API's daily quota at its free monthly allowance divided by 31.
- [ ] Supabase Auth: enable the Google provider with the OAuth client ID and secret; add the Vercel URL and `http://localhost:3000` as redirect URLs.
- [ ] After the first migration runs: enable the hook under Authentication > Hooks > Before User Created, pointing at the hook function, and add your own email to `allowed_emails` as `owner`.
- [ ] Vercel: import the repo, add the env vars below, deploy.
- [ ] Phase 2 only: Gemini API key from Google AI Studio, and an Apify account and API token.

**Environment variables**

| Name | Used by | Secret |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | No |
| `SUPABASE_SECRET_KEY` | Keep-alive route only | Yes |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Map and venue search in the browser | No, referrer-restricted |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Map in the browser | No |
| `GOOGLE_PLACES_SERVER_KEY` | Keep-alive coordinate refresh | Yes |
| `CRON_SECRET` | Keep-alive route; Vercel sends it as the Bearer token | Yes |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Import route (Phase 2) | Yes |
| `APIFY_TOKEN` | Import route (Phase 2) | Yes |

**Project layout**

```text
proxy.ts                          session refresh, redirect signed-out visitors
app/layout.tsx                    server-side user + allowlist check
app/page.tsx                      map + list for ?date= (list server-rendered)
app/login/page.tsx                "Continue with Google"
app/not-on-the-list/page.tsx
app/auth/callback/route.ts        Supabase OAuth code exchange
app/api/keep-alive/route.ts       daily cron
app/actions/deals.ts              Server Actions: create, update, delete
components/map/                   client-only Google map, markers, clusterer
components/list/                  deal list, date chips
lib/supabase/server.ts, client.ts @supabase/ssr clients
lib/deals/is-deal-on.ts           recurrence rule, pure function
lib/tags/rules.ts                 fixed tag list + keyword rules
supabase/migrations/0001_init.sql tables, grants, RLS, hook function
vercel.json                       cron entry
```

**Rules not stated elsewhere**

- `category` is an enum: `food`, `drink`, `both`.
- `tags` is checked against the fixed list, both in code (one shared constant) and by a database check constraint.
- `start_time` and `end_time` are Melbourne local times; both null means all day.
- All date logic uses `Intl.DateTimeFormat` with `timeZone: 'Australia/Melbourne'`, never the device time zone.

**Tests that must pass before Phase 1 is done**

- Vitest unit tests for `isDealOn`: weekday match, valid-from and valid-until bounds, one-off deals, and Melbourne's daylight-saving change days in April and October.
- Unit tests for the tag keyword rules.
- An RLS check: a non-allowlisted user reads zero deals, and a member can't update another member's deal.
- Manual: sign in on Android Chrome and desktop, add a deal in under 30 seconds, and switch dates with no network request.

**Guardrails**

- TypeScript strict mode, no `any`.
- No services or paid libraries beyond this spec without asking first.
- Secret keys never reach the browser.
- Ask before changing the data model.

**Phase 2 import contract**

Gemini must return JSON in this shape; nulls mean the post didn't say.

```ts
type ImportDraft = {
  venue: { name: string | null; suburb: string | null; instagramHandle: string | null };
  deals: Array<{
    title: string | null;
    priceCents: number | null;
    category: 'food' | 'drink' | 'both' | null;
    days: number[];            // 0 = Sunday … 6 = Saturday; empty if not stated
    startTime: string | null;  // "HH:MM", 24-hour, Melbourne time
    endTime: string | null;
    tags: Tag[];               // only from the fixed list
    uncertain: string[];       // field names to outline in amber
  }>;
};
```

## Costs and limits

Total running cost is $0 a month; none of the free-tier limits come close to a crew's usage except Supabase's inactivity pause, which the keep-alive handles. Google needs a card on file, so per-API daily quotas hold usage inside its free caps.

| Service | Plan | Cost | Limit that matters here |
| --- | --- | --- | --- |
| [Supabase](https://automationatlas.io/answers/supabase-free-tier-limits-2026/) | Free | $0 | Pauses after 1 week idle (handled). 500 MB database, 50,000 monthly users and 2 free projects per account, all far above need |
| [Vercel](https://zplatform.ai/guides/is-vercel-free/) | Hobby | $0 | Non-commercial use only; scheduled jobs at most once a day |
| [Google Maps Platform](https://mapsplatform.google.com/maps-products/places) | Pay-as-you-go with free caps | $0 | 10,000 free calls a month per Essentials SKU, 5,000 per Pro SKU, 1,000 per Enterprise SKU; card required, so set quotas |
| [Apify](https://www.xpoz.ai/blog/guides/instagram-api-pricing-2026/) | Free | $0 | $5 of credit a month; about $2.70 per 1,000 posts, so roughly 1,800 imports a month |
| [Gemini API](https://pasqualepillitteri.it/en/news/6683/gemini-2-5-flash-free-1m-tokens) | Free tier | $0 | About 15 requests a minute on Flash; inputs may be used to improve Google's models |
| Google OAuth | None | $0 | Only email and profile scopes requested |
| Custom domain | Not wanted | $0 | The free `vercel.app` address is used |

If the pause ever becomes a real nuisance, Supabase Pro removes it but costs [$25 a month per project](https://www.itpathsolutions.com/supabase-free-tier-limits), which is hard to justify for this.

## Decisions

All earlier open questions are settled; the build follows these.

- [x] Name: Mates Rates
- [x] One crew
- [x] Members edit their own deals; the owner edits all
- [x] Food and drink deals both in scope
- [x] Public holiday exceptions wait for Phase 3
- [x] Map and venue search: Google Maps (OpenStreetMap search missed 3 of 3 test venues)
- [x] iPhone mates paste links; Android gets the share sheet
- [x] A scraping service for link imports is fine
- [x] Shared posts can go through Gemini's free tier
- [x] No custom domain

## Sources

- [Supabase changelog: explicit grants for the Data API](https://supabase.com/changelog?tags=mcp)
- [Supabase docs: before user created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Supabase Auth issue: hook rejection shown as generic error](https://github.com/supabase/auth/issues/2235)
- [Neon vs Supabase free plan](https://neon.com/guides/neon-vs-supabase-free-plan)
- [IT Path Solutions: Supabase free tier limits](https://www.itpathsolutions.com/supabase-free-tier-limits)
- [Automation Atlas: Supabase free tier limits 2026](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)
- [Vercel docs: cron job usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Is Vercel free? Hobby plan guide](https://zplatform.ai/guides/is-vercel-free/)
- [GitHub docs: disabling and enabling a workflow](https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow)
- [Next.js 16: what's new (MakerKit)](https://makerkit.dev/blog/md/tutorials/nextjs-16)
- [@vis.gl/react-google-maps](https://www.npmjs.com/package/@vis.gl/react-google-maps)
- [Google: marker clustering](https://developers.google.com/maps/articles/toomanymarkers)
- [Google Maps Platform: Places pricing and free caps](https://mapsplatform.google.com/maps-products/places)
- [Google Maps Platform service terms: caching](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522)
- [Apple developer forums: MapKit JS needs a paid membership](https://developer.apple.com/forums/thread/729746)
- [web.dev: PWA OS integration (share target support)](https://web.dev/learn/pwa/os-integration)
- [Meta: oEmbed Read feature](https://developers.facebook.com/documentation/development/features-reference/oembed-read)
- [Meta: oEmbed Read requirements](https://developers.facebook.com/docs/features-reference/oembed-read?locale=zh_TW)
- [Instagram scraper notes on blocked cloud IPs](https://github.com/ChocoData-com/instagram-scraper)
- [Instagram API pricing 2026, incl. Apify (Xpoz)](https://www.xpoz.ai/blog/guides/instagram-api-pricing-2026/)
- [Gemini 2.5 Flash free tier limits](https://pasqualepillitteri.it/en/news/6683/gemini-2-5-flash-free-1m-tokens)
- [Gemini API pricing 2026 (GeoToolbox)](https://geotoolbox.ai/blog/gemini-api-pricing.md)
- [Gemini API free tier changes](https://blog.laozhang.ai/en/posts/gemini-api-free-tier)
- [Supabase pause warning email (write-up)](https://dev.to/astraedus/my-production-app-was-down-for-24-hours-and-nobody-told-me-3nma)
