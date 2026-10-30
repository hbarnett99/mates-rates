import { describe, expect, it } from 'vitest';
import type { DealCategory, VenueRow } from '@/lib/db/types';
import { venuesForDate } from './for-date';
import type { Deal } from './types';

const SAT = '2026-10-24';

function venue(id: string, name: string, lat: number, lng: number): VenueRow {
  return {
    id,
    name,
    suburb: null,
    google_place_id: null,
    lat,
    lng,
    location_refreshed_at: null,
    instagram_handle: null,
    created_by: 'u1',
  };
}

const corner = venue('v1', 'Corner Hotel', -37.8243, 144.9925); // Richmond
const espy = venue('v2', 'Esplanade Hotel', -37.8676, 144.9768); // St Kilda
const lomond = venue('v3', 'Lomond Hotel', -37.7714, 144.9967); // Brunswick East

let nextId = 0;
function deal(v: VenueRow, title: string, priceCents: number, category: DealCategory, days = [6]): Deal {
  nextId += 1;
  return {
    id: `d${nextId}`,
    venue_id: v.id,
    title,
    price_cents: priceCents,
    category,
    tags: [],
    days,
    start_time: null,
    end_time: null,
    valid_from: null,
    valid_until: null,
    notes: null,
    source_url: null,
    last_confirmed_at: '2026-10-01T00:00:00Z',
    created_by: 'u1',
    updated_at: '2026-10-01T00:00:00Z',
    venue: v,
    creator: { display_name: 'Henry' },
  };
}

describe('venuesForDate', () => {
  const deals = [
    deal(corner, 'Parma + pot', 2800, 'food'),
    deal(corner, '$8 pints', 800, 'drink'),
    deal(espy, 'Sunday roast', 3500, 'food', [0]),
    deal(espy, 'Burger', 2000, 'food'),
    deal(lomond, 'Happy hour', 900, 'drink'),
  ];

  it('keeps only deals on that date and groups them by venue', () => {
    const groups = venuesForDate(deals, SAT, { sort: 'price' });
    expect(groups.map((g) => g.venue.name)).toEqual(['Corner Hotel', 'Lomond Hotel', 'Esplanade Hotel']);
    expect(groups.find((g) => g.venue.id === 'v2')?.deals.map((d) => d.title)).toEqual(['Burger']);
  });

  it('labels each venue with its lowest price and sorts its deals by price', () => {
    const cornerGroup = venuesForDate(deals, SAT).find((g) => g.venue.id === 'v1');
    expect(cornerGroup?.lowestPriceCents).toBe(800);
    expect(cornerGroup?.deals.map((d) => d.title)).toEqual(['$8 pints', 'Parma + pot']);
  });

  it('colours a venue by the mix of categories', () => {
    const groups = venuesForDate(deals, SAT);
    const category = (id: string) => groups.find((g) => g.venue.id === id)?.category;
    expect(category('v1')).toBe('both');
    expect(category('v2')).toBe('food');
    expect(category('v3')).toBe('drink');
  });

  it('treats a single "both" deal as both', () => {
    const groups = venuesForDate([deal(corner, 'Parma and a pint', 2500, 'both')], SAT);
    expect(groups[0]?.category).toBe('both');
  });

  it('sorts by distance when a location is shared', () => {
    const stKilda = { lat: -37.8679, lng: 144.9807 };
    const groups = venuesForDate(deals, SAT, { location: stKilda });
    expect(groups.map((g) => g.venue.name)).toEqual(['Esplanade Hotel', 'Corner Hotel', 'Lomond Hotel']);
    expect(groups[0]?.distance).toBeLessThan(500);
  });

  it('falls back to price when no location is shared', () => {
    const groups = venuesForDate(deals, SAT, { sort: 'distance' });
    expect(groups.map((g) => g.lowestPriceCents)).toEqual([800, 900, 2000]);
    expect(groups[0]?.distance).toBeNull();
  });

  it('returns nothing on a date with no deals', () => {
    expect(venuesForDate(deals, '2026-10-21')).toEqual([]);
  });
});
