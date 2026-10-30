import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { withUser } from '@/lib/db';
import { setVenueLocation, venuesNeedingRefresh } from '@/lib/db/queries';

/**
 * Daily Vercel cron (vercel.json). Refreshes venue coordinates from Google
 * before Places' 30-day caching limit runs out.
 */

export const dynamic = 'force-dynamic';

const REFRESH_AFTER_DAYS = 25;
/** Plenty for a crew; keeps one run well inside the function time limit. */
const MAX_REFRESHES = 50;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Place Details (New), location field only. */
async function fetchLocation(placeId: string, key: string): Promise<{ lat: number; lng: number } | null> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('location' in body)) return null;
  const location = body.location;
  if (typeof location !== 'object' || location === null) return null;
  const lat = 'latitude' in location ? location.latitude : null;
  const lng = 'longitude' in location ? location.longitude : null;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const key = process.env.GOOGLE_PLACES_SERVER_KEY;
  if (!key) {
    console.error('refresh-venues: GOOGLE_PLACES_SERVER_KEY is not set');
    return NextResponse.json({ error: 'GOOGLE_PLACES_SERVER_KEY is not set' }, { status: 500 });
  }

  const problems: string[] = [];
  const updates: { id: string; location: { lat: number; lng: number } }[] = [];
  try {
    // No signed-in user: the job only calls the two refresh functions, which
    // touch nothing but coordinates.
    const stale = await withUser(null, (tx) =>
      venuesNeedingRefresh(tx, { limit: MAX_REFRESHES, olderThanDays: REFRESH_AFTER_DAYS }),
    );
    for (const venue of stale) {
      try {
        const location = await fetchLocation(venue.google_place_id, key);
        if (location) updates.push({ id: venue.id, location });
        else problems.push(`no location for venue ${venue.id}`);
      } catch (error) {
        problems.push(`venue ${venue.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (updates.length > 0) {
      await withUser(null, async (tx) => {
        for (const { id, location } of updates) await setVenueLocation(tx, id, location);
      });
    }
  } catch (error) {
    console.error('refresh-venues: database error', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const refreshed = updates.length;
  if (problems.length > 0) {
    console.error('refresh-venues: completed with problems', problems);
    return NextResponse.json({ refreshed, problems }, { status: 500 });
  }
  return NextResponse.json({ refreshed });
}
