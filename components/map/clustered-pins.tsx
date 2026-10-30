'use client';

import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORY_BG, CATEGORY_CLASS } from '@/components/category';
import type { VenueGroup } from '@/lib/deals/for-date';
import { formatPrice } from '@/lib/format';

type Props = {
  groups: VenueGroup[];
  selectedVenueId: string | null;
  onSelect: (venueId: string) => void;
};

/** Cluster bubbles: a count that zooms in when tapped (the clusterer's default click). */
function clusterRenderer(markerLib: google.maps.MarkerLibrary): Renderer {
  return {
    render({ count, position }) {
      const bubble = document.createElement('div');
      bubble.className =
        'pin-enter flex size-11 items-center justify-center rounded-full bg-raised text-sm font-bold text-text ring-2 ring-accent shadow-lg';
      bubble.textContent = String(count);
      return new markerLib.AdvancedMarkerElement({ position, content: bubble, zIndex: 1000 + count });
    },
  };
}

type PinProps = {
  group: VenueGroup;
  selected: boolean;
  onSelect: (venueId: string) => void;
  setMarkerRef: (marker: google.maps.marker.AdvancedMarkerElement | null, key: string) => void;
};

const PricePin = memo(function PricePin({ group, selected, onSelect, setMarkerRef }: PinProps) {
  const venueId = group.venue.id;
  // A stable ref callback, so React doesn't detach and reattach on every render.
  const ref = useCallback(
    (marker: google.maps.marker.AdvancedMarkerElement | null) => setMarkerRef(marker, venueId),
    [setMarkerRef, venueId],
  );

  return (
    <AdvancedMarker
      ref={ref}
      position={{ lat: group.venue.lat, lng: group.venue.lng }}
      onClick={() => onSelect(venueId)}
      zIndex={selected ? 900 : undefined}
      title={group.venue.name}
    >
      <div className={`pin-enter flex flex-col items-center transition-transform ${selected ? 'scale-115' : ''}`}>
        <span
          className={`flex min-h-8 min-w-11 items-center justify-center rounded-full px-2.5 text-sm font-bold shadow-lg ring-2 ${
            selected ? 'ring-text' : 'ring-bg'
          } ${CATEGORY_CLASS[group.category]}`}
        >
          {formatPrice(group.lowestPriceCents)}
        </span>
        <span
          aria-hidden="true"
          className={`-mt-1 size-2.5 rotate-45 ${CATEGORY_BG[group.category]}`}
        />
      </div>
    </AdvancedMarker>
  );
});

/** One price pin per venue, merged into count bubbles when zoomed out. */
export function ClusteredPins({ groups, selectedVenueId, onSelect }: Props) {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');
  const [markers, setMarkers] = useState<Record<string, google.maps.marker.AdvancedMarkerElement>>({});

  const clusterer = useMemo(
    () => (map && markerLib ? new MarkerClusterer({ map, renderer: clusterRenderer(markerLib) }) : null),
    [map, markerLib],
  );

  useEffect(() => () => clusterer?.setMap(null), [clusterer]);

  useEffect(() => {
    if (!clusterer) return;
    clusterer.clearMarkers(true);
    clusterer.addMarkers(Object.values(markers));
  }, [clusterer, markers]);

  const setMarkerRef = useCallback((marker: google.maps.marker.AdvancedMarkerElement | null, key: string) => {
    setMarkers((prev) => {
      if (marker ? prev[key] === marker : !(key in prev)) return prev;
      if (marker) return { ...prev, [key]: marker };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return groups.map((group) => (
    <PricePin
      key={group.venue.id}
      group={group}
      selected={group.venue.id === selectedVenueId}
      onSelect={onSelect}
      setMarkerRef={setMarkerRef}
    />
  ));
}
