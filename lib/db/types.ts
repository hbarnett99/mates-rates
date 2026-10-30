// Row shapes for db/migrations/0001_init.sql, as the queries in
// lib/db/queries.ts return them: JSON-encoded, so timestamps are ISO strings,
// dates are YYYY-MM-DD and times are HH:MM:SS.

export type CrewRole = 'owner' | 'member';
export type DealCategory = 'food' | 'drink' | 'both';

export type VenueRow = {
  id: string;
  name: string;
  suburb: string | null;
  google_place_id: string | null;
  lat: number;
  lng: number;
  location_refreshed_at: string | null;
  instagram_handle: string | null;
  created_by: string | null;
};

export type DealRow = {
  id: string;
  venue_id: string;
  title: string;
  price_cents: number;
  category: DealCategory;
  tags: string[];
  days: number[];
  start_time: string | null;
  end_time: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  source_url: string | null;
  last_confirmed_at: string;
  created_by: string | null;
  updated_at: string;
};

/** The columns a deal form writes. */
export type DealWrite = Pick<
  DealRow,
  | 'venue_id'
  | 'title'
  | 'price_cents'
  | 'category'
  | 'tags'
  | 'days'
  | 'start_time'
  | 'end_time'
  | 'valid_from'
  | 'valid_until'
  | 'notes'
>;
