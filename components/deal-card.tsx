'use client';

import { useState } from 'react';
import { CATEGORY_CLASS } from '@/components/category';
import { daysLabel, formatMelbourneDay } from '@/lib/dates';
import type { VenueGroup } from '@/lib/deals/for-date';
import { canEdit, type Deal, type Viewer } from '@/lib/deals/types';
import { formatDistance, formatPrice, formatTimeWindow } from '@/lib/format';
import { directionsUrl } from '@/lib/geo';

type Props = {
  group: VenueGroup;
  viewer: Viewer;
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
  onClose: () => void;
};

/** A venue's deals for the chosen date: the card that opens from a pin. */
export function DealCard({ group, viewer, onEdit, onDelete, onClose }: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { venue } = group;

  return (
    <article className="flex max-h-[min(70dvh,32rem)] flex-col rounded-2xl bg-surface shadow-2xl ring-1 ring-line">
      <header className="flex items-start gap-3 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold">{venue.name}</h2>
          <p className="text-sm text-muted">
            {[venue.suburb, group.distance !== null ? formatDistance(group.distance) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-text"
        >
          ✕
        </button>
      </header>

      <ul className="flex-1 divide-y divide-line overflow-y-auto px-4">
        {group.deals.map((deal) => {
          const saving = deal.id.startsWith('temp-');
          return (
            <li key={deal.id} className="space-y-1.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{deal.title}</h3>
                <span className={`shrink-0 rounded-md px-2 text-sm leading-6 font-bold ${CATEGORY_CLASS[deal.category]}`}>
                  {formatPrice(deal.price_cents)}
                </span>
              </div>
              <p className="text-sm text-muted">
                {formatTimeWindow(deal.start_time, deal.end_time)} · {daysLabel(deal.days)}
              </p>
              {deal.notes && <p className="text-sm whitespace-pre-line">{deal.notes}</p>}
              {deal.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {deal.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-raised px-2 py-0.5 text-xs">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">
                {saving
                  ? 'Saving…'
                  : `Added by ${deal.creator?.display_name ?? 'a former mate'} · Confirmed ${formatMelbourneDay(deal.last_confirmed_at)}`}
              </p>
              {!saving && canEdit(viewer, deal) && (
                <div className="flex gap-2 pt-1">
                  {confirmingId === deal.id ? (
                    <>
                      <span className="self-center text-sm">Delete this deal?</span>
                      <button
                        type="button"
                        onClick={() => onDelete(deal)}
                        className="min-h-11 rounded-full bg-danger px-4 text-sm font-medium text-pin-text"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="min-h-11 rounded-full bg-raised px-4 text-sm"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(deal)}
                        className="min-h-11 rounded-full bg-raised px-4 text-sm hover:bg-line"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(deal.id)}
                        className="min-h-11 rounded-full px-4 text-sm text-danger hover:bg-raised"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="p-4 pt-2">
        <a
          href={directionsUrl(venue)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center rounded-full bg-accent font-semibold text-pin-text"
        >
          Directions
        </a>
      </div>
    </article>
  );
}
