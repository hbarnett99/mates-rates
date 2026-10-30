'use client';

import { useMapsLibrary } from '@vis.gl/react-google-maps';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VenueInput } from '@/lib/deals/input';
import { MELBOURNE_CENTRE, type LatLng } from '@/lib/geo';
import type { VenueRow } from '@/lib/db/types';

const PinPicker = dynamic(() => import('./pin-picker'), {
  ssr: false,
  loading: () => <div className="skeleton h-56 rounded-xl" />,
});

/** The venue picked in the form, with enough detail to show it and draw an optimistic pin. */
export type VenueChoice = { input: VenueInput; name: string; detail: string | null; position: LatLng };

export function choiceFromVenue(venue: VenueRow): VenueChoice {
  return {
    input: { kind: 'existing', id: venue.id },
    name: venue.name,
    detail: venue.suburb,
    position: { lat: venue.lat, lng: venue.lng },
  };
}

type Props = {
  venues: VenueRow[];
  /** The visible map area, so suggestions favour what's on screen. */
  bounds: google.maps.LatLngBoundsLiteral | null;
  value: VenueChoice | null;
  onChange: (choice: VenueChoice | null) => void;
  autoFocus?: boolean;
};

type Suggestion =
  | { kind: 'existing'; venue: VenueRow }
  | { kind: 'google'; prediction: google.maps.places.PlacePrediction };

const DEBOUNCE_MS = 200;
const MAX_EXISTING = 4;

function suburbOf(place: google.maps.places.Place): string | null {
  const parts = place.addressComponents ?? [];
  const locality = parts.find((c) => c.types.includes('locality')) ?? parts.find((c) => c.types.includes('sublocality'));
  return locality?.longText ?? null;
}

export function VenueSearch({ venues, bounds, value, onChange, autoFocus }: Props) {
  const places = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [searchError, setSearchError] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestId = useRef(0);

  const trimmed = query.trim();

  const existing = useMemo(() => {
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return venues.filter((v) => v.name.toLowerCase().includes(q)).slice(0, MAX_EXISTING);
  }, [venues, trimmed]);

  useEffect(() => {
    if (!places || trimmed.length < 2 || dropping) {
      setPredictions([]);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      sessionToken.current ??= new places.AutocompleteSessionToken();
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionToken.current,
          locationBias: bounds ?? { center: MELBOURNE_CENTRE, radius: 20_000 },
          includedRegionCodes: ['au'],
        });
        if (id !== requestId.current) return;
        setSearchError(false);
        setPredictions(suggestions.flatMap((s) => (s.placePrediction ? [s.placePrediction] : [])));
      } catch {
        if (id !== requestId.current) return;
        setSearchError(true);
        setPredictions([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [places, trimmed, bounds, dropping]);

  // Venues already in the app come first; hide Google results that duplicate them.
  const suggestions: Suggestion[] = [
    ...existing.map((venue) => ({ kind: 'existing' as const, venue })),
    ...predictions
      .filter((p) => !venues.some((v) => v.google_place_id === p.placeId))
      .map((prediction) => ({ kind: 'google' as const, prediction })),
  ];

  async function pickPrediction(prediction: google.maps.places.PlacePrediction) {
    const known = venues.find((v) => v.google_place_id === prediction.placeId);
    if (known) {
      onChange(choiceFromVenue(known));
      return;
    }
    // Location and address are the cheaper Essentials fields; the name comes from the prediction.
    const place = prediction.toPlace();
    try {
      await place.fetchFields({ fields: ['location', 'addressComponents'] });
    } catch {
      setSearchError(true);
      return;
    }
    sessionToken.current = null;
    const location = place.location?.toJSON();
    if (!location) {
      setSearchError(true);
      return;
    }
    const name = prediction.mainText?.text ?? prediction.text.text;
    const suburb = suburbOf(place);
    onChange({
      input: { kind: 'place', googlePlaceId: prediction.placeId, name, suburb, lat: location.lat, lng: location.lng },
      name,
      detail: prediction.secondaryText?.text ?? suburb,
      position: location,
    });
  }

  /** A dropped pin takes its name from whatever is typed in the search box. */
  function choosePin(position: LatLng, typedName: string) {
    const name = typedName.trim() || 'Dropped pin';
    onChange({
      input: { kind: 'pin', name, suburb: null, lat: position.lat, lng: position.lng },
      name,
      detail: 'Dropped pin',
      position,
    });
  }

  function placePin(position: LatLng) {
    setPin(position);
    choosePin(position, query);
  }

  if (value && !dropping) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-raised p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{value.name}</p>
          {value.detail && <p className="truncate text-sm text-muted">{value.detail}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery(value.input.kind === 'pin' ? value.name : '');
            onChange(null);
          }}
          className="min-h-11 rounded-full px-4 text-sm text-accent hover:bg-line"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (dropping && pin) choosePin(pin, e.target.value);
        }}
        placeholder="Venue name, e.g. Corner Hotel"
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        aria-label="Venue"
        className="min-h-12 w-full rounded-xl bg-raised px-4 placeholder:text-muted focus:ring-2 focus:ring-accent focus:outline-none"
      />

      {dropping ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {pin ? 'Drag the pin to adjust it.' : 'Tap the map where the venue is.'} The name above is what shows on the map.
          </p>
          <PinPicker centre={bounds ? centreOf(bounds) : MELBOURNE_CENTRE} value={pin} onChange={placePin} />
          <button
            type="button"
            onClick={() => {
              setDropping(false);
              setPin(null);
              onChange(null);
            }}
            className="min-h-11 text-sm text-muted hover:text-text"
          >
            Back to search
          </button>
        </div>
      ) : (
        <>
          {suggestions.length > 0 && (
            <ul className="overflow-hidden rounded-xl bg-raised" role="listbox" aria-label="Venues">
              {suggestions.map((s) =>
                s.kind === 'existing' ? (
                  <li key={`v-${s.venue.id}`}>
                    <button
                      type="button"
                      onClick={() => onChange(choiceFromVenue(s.venue))}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-line"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.venue.name}</span>
                        {s.venue.suburb && <span className="block truncate text-sm text-muted">{s.venue.suburb}</span>}
                      </span>
                      <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-xs text-muted">In the app</span>
                    </button>
                  </li>
                ) : (
                  <li key={`g-${s.prediction.placeId}`}>
                    <button
                      type="button"
                      onClick={() => void pickPrediction(s.prediction)}
                      className="flex min-h-12 w-full flex-col justify-center px-4 py-2 text-left hover:bg-line"
                    >
                      <span className="block truncate font-medium">{s.prediction.mainText?.text ?? s.prediction.text.text}</span>
                      {s.prediction.secondaryText && (
                        <span className="block truncate text-sm text-muted">{s.prediction.secondaryText.text}</span>
                      )}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
          {searchError && <p className="text-sm text-danger">Venue search isn’t working right now. Drop a pin instead.</p>}
          <button
            type="button"
            onClick={() => setDropping(true)}
            className="min-h-11 text-sm text-accent hover:underline"
          >
            Can’t find it? Drop a pin
          </button>
        </>
      )}
    </div>
  );
}

function centreOf(bounds: google.maps.LatLngBoundsLiteral): LatLng {
  return { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 };
}
