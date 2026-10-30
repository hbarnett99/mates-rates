'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import { startTransition, useCallback, useMemo, useOptimistic, useRef, useState, type CSSProperties } from 'react';
import { signOut } from '@/app/actions/auth';
import { createDeal, deleteDeal, updateDeal } from '@/app/actions/deals';
import { DealCard } from '@/components/deal-card';
import { DealForm } from '@/components/deal-form/deal-form';
import type { VenueChoice } from '@/components/deal-form/venue-search';
import { DateChips } from '@/components/list/date-chips';
import { DealList } from '@/components/list/deal-list';
import { DealsMapLoader } from '@/components/map/deals-map-loader';
import type { MapFocus } from '@/components/map/deals-map';
import { Toasts, useToasts } from '@/components/toasts';
import { longDayLabel } from '@/lib/dates';
import { venuesForDate, type SortOrder, type VenueGroup } from '@/lib/deals/for-date';
import type { DealInput } from '@/lib/deals/input';
import { weekdayOf, type IsoDate } from '@/lib/deals/is-deal-on';
import type { Deal, Viewer } from '@/lib/deals/types';
import { googleMapsApiKey } from '@/lib/env';
import type { LatLng } from '@/lib/geo';
import type { VenueRow } from '@/lib/db/types';
import { applyTagRules } from '@/lib/tags/rules';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { useBottomSheet } from './use-bottom-sheet';

type Props = {
  initialDeals: Deal[];
  venues: VenueRow[];
  today: IsoDate;
  initialDate: IsoDate;
  viewer: Viewer;
  email: string | null;
};

type Editor = { deal: Deal | null } | null;
type OptimisticChange = { type: 'upsert'; deal: Deal } | { type: 'remove'; id: string };

function applyChange(deals: Deal[], change: OptimisticChange): Deal[] {
  if (change.type === 'remove') return deals.filter((d) => d.id !== change.id);
  return [...deals.filter((d) => d.id !== change.deal.id), change.deal];
}

/** A stand-in Deal so the pin and row appear before the server confirms. */
function optimisticDeal(input: DealInput, venue: VenueChoice, existing: Deal | null, viewer: Viewer, venues: VenueRow[]): Deal {
  const choice = input.venue;
  const venueRow: VenueRow = (choice.kind === 'existing' && venues.find((v) => v.id === choice.id)) || {
      id: `temp-venue-${venue.position.lat},${venue.position.lng}`,
      name: venue.name,
      suburb: choice.kind === 'existing' ? null : choice.suburb,
      google_place_id: choice.kind === 'place' ? choice.googlePlaceId : null,
      lat: venue.position.lat,
      lng: venue.position.lng,
      location_refreshed_at: null,
      instagram_handle: null,
      created_by: viewer.id,
    };
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? `temp-${crypto.randomUUID()}`,
    venue_id: venueRow.id,
    title: input.title,
    price_cents: input.priceCents,
    category: input.category,
    tags: applyTagRules({ title: input.title, notes: input.notes, tags: input.tags, dismissed: input.dismissedTags }),
    days: input.days,
    start_time: input.startTime,
    end_time: input.endTime,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
    notes: input.notes,
    source_url: existing?.source_url ?? null,
    last_confirmed_at: existing?.last_confirmed_at ?? now,
    created_by: existing?.created_by ?? viewer.id,
    updated_at: now,
    venue: venueRow,
    creator: existing?.creator ?? null,
  };
}

export function DealsApp({ initialDeals, venues: initialVenues, today, initialDate, viewer, email }: Props) {
  const [deals, setDeals] = useState(initialDeals);
  const [venues, setVenues] = useState(initialVenues);
  const [optimisticDeals, applyOptimistic] = useOptimistic(deals, applyChange);
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [sort, setSort] = useState<SortOrder>('distance');
  const [editor, setEditor] = useState<Editor>(null);
  const [bounds, setBounds] = useState<google.maps.LatLngBoundsLiteral | null>(null);
  const { toasts, showToast, dismissToast } = useToasts();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const sheet = useBottomSheet();
  const { snapTo } = sheet;
  const focusNonce = useRef(0);

  const groups = useMemo(
    () => venuesForDate(optimisticDeals, date, { location: userLocation, sort }),
    [optimisticDeals, date, userLocation, sort],
  );
  const selectedGroup = groups.find((g) => g.venue.id === selectedVenueId) ?? null;
  const dateLabel = date === today ? 'Today' : longDayLabel(date, today);

  /** Switch dates on the device: no network, just filter and update the URL. */
  const changeDate = useCallback(
    (next: IsoDate) => {
      setDate(next);
      const url = new URL(window.location.href);
      if (next === today) url.searchParams.delete('date');
      else url.searchParams.set('date', next);
      window.history.replaceState(window.history.state, '', url);
    },
    [today],
  );

  const selectFromList = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      focusNonce.current += 1;
      setFocus({ venueId, nonce: focusNonce.current });
      setView('map');
      snapTo('peek');
    },
    [snapTo],
  );

  const selectFromMap = useCallback((venueId: string | null) => setSelectedVenueId(venueId), []);

  function save(input: DealInput, venue: VenueChoice, existing: Deal | null) {
    const placeholder = optimisticDeal(input, venue, existing, viewer, venues);
    setEditor(null);
    setSelectedVenueId(placeholder.venue_id);
    startTransition(async () => {
      applyOptimistic({ type: 'upsert', deal: placeholder });
      const result = existing ? await updateDeal(existing.id, input) : await createDeal(input);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      const saved = result.deal;
      startTransition(() => {
        setDeals((prev) => applyChange(prev, { type: 'upsert', deal: saved }));
        setVenues((prev) =>
          prev.some((v) => v.id === saved.venue.id)
            ? prev
            : [...prev, saved.venue].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setSelectedVenueId((current) => (current === placeholder.venue_id ? saved.venue_id : current));
      });
    });
  }

  function remove(deal: Deal) {
    startTransition(async () => {
      applyOptimistic({ type: 'remove', id: deal.id });
      const result = await deleteDeal(deal.id);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      startTransition(() => setDeals((prev) => applyChange(prev, { type: 'remove', id: deal.id })));
    });
  }

  const renderCard = (group: VenueGroup) => (
    <DealCard
      group={group}
      viewer={viewer}
      onEdit={(deal) => setEditor({ deal })}
      onDelete={remove}
      onClose={() => setSelectedVenueId(null)}
    />
  );

  const onLocation = useCallback((here: LatLng) => {
    setUserLocation(here);
    setSort('distance');
  }, []);

  const addButton = (
    <button
      type="button"
      onClick={() => setEditor({ deal: null })}
      className="min-h-11 rounded-full bg-accent px-4 font-semibold text-pin-text"
    >
      + Add deal
    </button>
  );

  // On phone, map view shows the list as a bottom sheet. Its classes are all
  // max-lg: so desktop is unaffected, including before hydration.
  const sheetOnMap = view === 'map';

  return (
    <APIProvider apiKey={googleMapsApiKey()} libraries={['marker', 'places']} region="AU" language="en-AU">
      <div
        className="relative h-dvh overflow-hidden lg:grid lg:grid-cols-[380px_1fr]"
        style={{ '--top-bar': 'calc(env(safe-area-inset-top) + 6.75rem)' } as CSSProperties}
      >
        {/* Map: full screen on phone, the right side on desktop. */}
        <div className="absolute inset-0 lg:relative lg:order-2">
          <DealsMapLoader
            groups={groups}
            selectedVenueId={selectedVenueId}
            focus={focus}
            userLocation={userLocation}
            onSelectVenue={selectFromMap}
            onLocation={onLocation}
            onBoundsChange={setBounds}
            onLocateError={showToast}
            popup={isDesktop ? renderCard : null}
            locateClassName="bottom-[calc(env(safe-area-inset-bottom)+8.5rem)] lg:bottom-6"
          />
        </div>

        {/* Phone top bar: Map / List toggle and date chips. */}
        <header className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-bg via-bg/90 to-transparent pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex items-center justify-between gap-3 px-3 pt-2">
            <div className="flex rounded-full bg-surface p-1 ring-1 ring-line" role="group" aria-label="View">
              {(['map', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`min-h-10 rounded-full px-5 text-sm font-medium capitalize ${
                    view === v ? 'bg-raised text-text' : 'text-muted'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <span className="text-sm font-bold">
              Mates <span className="text-accent">Rates</span>
            </span>
          </div>
          <DateChips today={today} selected={date} onSelect={changeDate} className="px-3 py-2" />
        </header>

        {/* The list: a bottom sheet or full screen on phone, the left panel on desktop. */}
        <section
          aria-label="Deals"
          ref={sheet.ref}
          style={sheetOnMap ? sheet.style : undefined}
          className={`z-10 flex flex-col bg-surface max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-[var(--top-bar)] lg:relative lg:order-1 lg:h-dvh lg:border-r lg:border-line ${
            sheetOnMap
              ? `max-lg:translate-y-(--sheet-y) max-lg:rounded-t-2xl max-lg:shadow-2xl max-lg:ring-1 max-lg:ring-line ${
                  sheet.dragging ? '' : 'max-lg:transition-transform max-lg:duration-300 max-lg:ease-out-soft'
                }`
              : ''
          }`}
        >
          <div className="hidden space-y-3 border-b border-line p-4 lg:block">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">
                Mates <span className="text-accent">Rates</span>
              </h1>
              {addButton}
            </div>
            <DateChips today={today} selected={date} onSelect={changeDate} />
          </div>

          {sheetOnMap && (
            <div
              {...sheet.handleProps}
              className="flex min-h-11 shrink-0 cursor-grab touch-none items-center justify-center lg:hidden"
            >
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-4">
            <DealList
              groups={groups}
              dateLabel={dateLabel}
              selectedVenueId={selectedVenueId}
              onSelect={selectFromList}
              sort={sort}
              onSortChange={setSort}
              hasLocation={userLocation !== null}
            />
            <form action={signOut} className="px-4 pt-6 text-center text-xs text-muted">
              {email && <span>Signed in as {email} · </span>}
              <button type="submit" className="min-h-11 underline hover:text-text">
                Sign out
              </button>
            </form>
          </div>
        </section>

        {/* Phone: floating add button and the deal card sliding up from the bottom. */}
        {!isDesktop && !editor && (
          <button
            type="button"
            onClick={() => setEditor({ deal: null })}
            aria-label="Add deal"
            className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-30 flex size-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-pin-text shadow-xl lg:hidden"
          >
            +
          </button>
        )}
        {!isDesktop && view === 'map' && selectedGroup && (
          <div className="fixed inset-x-0 bottom-0 z-30 animate-[sheet-up_200ms_var(--ease-out-soft)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden">
            {renderCard(selectedGroup)}
          </div>
        )}

        {/* Add / edit: full-screen sheet on phone, side drawer on desktop. */}
        {editor && (
          <>
            <div className="fixed inset-0 z-40 hidden bg-bg/60 lg:block" onClick={() => setEditor(null)} aria-hidden="true" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={editor.deal ? 'Edit deal' : 'Add a deal'}
              className="fixed inset-0 z-50 animate-[sheet-up_200ms_var(--ease-out-soft)] bg-surface lg:inset-y-0 lg:right-auto lg:left-0 lg:w-[420px] lg:animate-[drawer-in_200ms_var(--ease-out-soft)] lg:shadow-2xl"
            >
              <DealForm
                deal={editor.deal}
                venues={venues}
                bounds={bounds}
                defaultDay={weekdayOf(date)}
                onSubmit={(input, venue) => save(input, venue, editor.deal)}
                onCancel={() => setEditor(null)}
              />
            </div>
          </>
        )}

        <Toasts toasts={toasts} onDismiss={dismissToast} />
      </div>
    </APIProvider>
  );
}
