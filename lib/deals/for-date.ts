import type { DealCategory, VenueRow } from '@/lib/db/types';
import { distanceMetres, type LatLng } from '@/lib/geo';
import { isDealOn, type IsoDate } from './is-deal-on';
import type { Deal } from './types';

/** One venue's deals for a date: one pin on the map, one heading in the list. */
export type VenueGroup = {
  venue: VenueRow;
  deals: Deal[];
  lowestPriceCents: number;
  /** Pin colour: food, drink, or both when the venue has a mix. */
  category: DealCategory;
  /** Metres from the viewer, when they've shared their location. */
  distance: number | null;
};

export type SortOrder = 'distance' | 'price';

function combinedCategory(deals: readonly Deal[]): DealCategory {
  const categories = new Set(deals.map((d) => d.category));
  if (categories.size === 1 && !categories.has('both')) return deals[0]?.category ?? 'both';
  return 'both';
}

/**
 * The venues with a deal running on `date`, each with its deals sorted by
 * price. Venues sort by distance when a location is given and the order asks
 * for it, otherwise by lowest price; ties fall back to venue name.
 */
export function venuesForDate(
  deals: readonly Deal[],
  date: IsoDate,
  options: { location?: LatLng | null; sort?: SortOrder } = {},
): VenueGroup[] {
  const byVenue = new Map<string, Deal[]>();
  for (const deal of deals) {
    if (!isDealOn(deal, date)) continue;
    const list = byVenue.get(deal.venue_id);
    if (list) list.push(deal);
    else byVenue.set(deal.venue_id, [deal]);
  }

  const location = options.location ?? null;
  const groups: VenueGroup[] = [];
  for (const venueDeals of byVenue.values()) {
    venueDeals.sort((a, b) => a.price_cents - b.price_cents || a.title.localeCompare(b.title));
    const first = venueDeals[0];
    if (!first) continue;
    groups.push({
      venue: first.venue,
      deals: venueDeals,
      lowestPriceCents: first.price_cents,
      category: combinedCategory(venueDeals),
      distance: location ? distanceMetres(location, first.venue) : null,
    });
  }

  const byDistance = (options.sort ?? 'distance') === 'distance' && location !== null;
  return groups.sort((a, b) => {
    const primary = byDistance ? (a.distance ?? 0) - (b.distance ?? 0) : a.lowestPriceCents - b.lowestPriceCents;
    return primary || a.venue.name.localeCompare(b.venue.name);
  });
}
