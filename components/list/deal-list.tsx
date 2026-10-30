'use client';

import { useEffect } from 'react';
import { CATEGORY_CLASS } from '@/components/category';
import type { SortOrder, VenueGroup } from '@/lib/deals/for-date';
import { formatDistance, formatPrice, formatTimeWindow } from '@/lib/format';

type Props = {
  groups: VenueGroup[];
  dateLabel: string;
  selectedVenueId: string | null;
  onSelect: (venueId: string) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  hasLocation: boolean;
};

export function venueRowId(venueId: string): string {
  return `venue-row-${venueId}`;
}

export function DealList({ groups, dateLabel, selectedVenueId, onSelect, sort, onSortChange, hasLocation }: Props) {
  // Tapping a pin scrolls its row into view.
  useEffect(() => {
    if (!selectedVenueId) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(venueRowId(selectedVenueId))
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [selectedVenueId]);

  const count = groups.reduce((n, g) => n + g.deals.length, 0);
  // Without a location, venuesForDate sorts by price whatever was picked.
  const effectiveSort: SortOrder = hasLocation ? sort : 'price';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <p className="text-sm text-muted">
          {count === 0 ? 'No deals' : count === 1 ? '1 deal' : `${count} deals`} · {dateLabel}
        </p>
        {count > 1 && (
          <div className="flex rounded-full bg-raised p-0.5 text-xs" role="group" aria-label="Sort by">
            {(['distance', 'price'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={effectiveSort === option}
                disabled={option === 'distance' && !hasLocation}
                title={option === 'distance' && !hasLocation ? 'Tap “locate me” on the map to sort by distance' : undefined}
                onClick={() => onSortChange(option)}
                className={`min-h-9 rounded-full px-3 capitalize disabled:opacity-40 ${
                  effectiveSort === option ? 'bg-line text-text' : 'text-muted'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="px-4 py-10 text-center text-muted">Nothing on yet. Know a deal? Add it.</p>
      ) : (
        <ul className="divide-y divide-line">
          {groups.map((group) => (
            <li key={group.venue.id} id={venueRowId(group.venue.id)}>
              <button
                type="button"
                onClick={() => onSelect(group.venue.id)}
                aria-current={group.venue.id === selectedVenueId ? 'true' : undefined}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-raised ${
                  group.venue.id === selectedVenueId ? 'bg-raised' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="truncate font-semibold">{group.venue.name}</h3>
                  {group.distance !== null && (
                    <span className="shrink-0 text-xs text-muted">{formatDistance(group.distance)}</span>
                  )}
                </div>
                {group.venue.suburb && <p className="text-xs text-muted">{group.venue.suburb}</p>}
                <ul className="mt-2 space-y-2">
                  {group.deals.map((deal) => (
                    <li key={deal.id} className={`flex gap-3 ${deal.id.startsWith('temp-') ? 'opacity-60' : ''}`}>
                      <span
                        className={`mt-0.5 h-6 shrink-0 rounded-md px-2 text-sm leading-6 font-bold ${CATEGORY_CLASS[deal.category]}`}
                      >
                        {formatPrice(deal.price_cents)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate">{deal.title}</p>
                        <p className="text-xs text-muted">
                          {formatTimeWindow(deal.start_time, deal.end_time)}
                          {deal.tags.length > 0 && ` · ${deal.tags.join(', ')}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
