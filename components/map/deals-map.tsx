'use client';

import { AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useState, type ReactNode } from 'react';
import type { VenueGroup } from '@/lib/deals/for-date';
import { googleMapId } from '@/lib/env';
import { MELBOURNE_CENTRE, type LatLng } from '@/lib/geo';
import { ClusteredPins } from './clustered-pins';

/** Ask the map to fly to a venue. `nonce` makes repeat requests for the same venue count. */
export type MapFocus = { venueId: string; nonce: number };

export type DealsMapProps = {
  groups: VenueGroup[];
  selectedVenueId: string | null;
  focus: MapFocus | null;
  userLocation: LatLng | null;
  onSelectVenue: (venueId: string | null) => void;
  onLocation: (location: LatLng) => void;
  onBoundsChange: (bounds: google.maps.LatLngBoundsLiteral) => void;
  onLocateError: (message: string) => void;
  /** Desktop only: the deal card, shown as a popup anchored to the selected pin. */
  popup: ((group: VenueGroup) => ReactNode) | null;
  /** Extra classes for the locate button, so it can sit above the phone's bottom sheet. */
  locateClassName?: string;
};

const FOCUS_ZOOM = 15;

/** Pans to a venue when the list asks, zooming in if needed. */
function FocusController({ focus, groups }: { focus: MapFocus | null; groups: VenueGroup[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !focus) return;
    const group = groups.find((g) => g.venue.id === focus.venueId);
    if (!group) return;
    map.panTo({ lat: group.venue.lat, lng: group.venue.lng });
    if ((map.getZoom() ?? 0) < FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM);
    // Only react to new focus requests, not to every change in groups.
  }, [map, focus]);
  return null;
}

function LocateButton({
  onLocation,
  onError,
  className,
}: {
  onLocation: (location: LatLng) => void;
  onError: (message: string) => void;
  className: string;
}) {
  const map = useMap();
  const [busy, setBusy] = useState(false);

  function locate() {
    if (!('geolocation' in navigator)) {
      onError('This browser can’t share your location.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocation(here);
        map?.panTo(here);
        if ((map?.getZoom() ?? 0) < 14) map?.setZoom(14);
      },
      () => {
        setBusy(false);
        onError('Couldn’t get your location. Check location permissions for this site.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <button
      type="button"
      onClick={locate}
      aria-label="Locate me"
      className={`absolute right-3 z-10 flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-lg ring-1 ring-line hover:bg-raised ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`size-6 ${busy ? 'animate-pulse text-accent' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );
}

/** The full-screen dark map. Client-only: load it through DealsMapLoader. */
export default function DealsMap(props: DealsMapProps) {
  const { groups, selectedVenueId, focus, userLocation, onSelectVenue, onBoundsChange, popup } = props;
  const selectedGroup = popup ? groups.find((g) => g.venue.id === selectedVenueId) : undefined;

  return (
    <div className="relative h-full w-full">
      <Map
        mapId={googleMapId()}
        colorScheme="DARK"
        renderingType="VECTOR"
        defaultCenter={MELBOURNE_CENTRE}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        className="h-full w-full"
        onClick={() => onSelectVenue(null)}
        onIdle={(e) => {
          const bounds = e.map.getBounds();
          if (bounds) onBoundsChange(bounds.toJSON());
        }}
      >
        <ClusteredPins groups={groups} selectedVenueId={selectedVenueId} onSelect={onSelectVenue} />
        <FocusController focus={focus} groups={groups} />
        {userLocation && (
          <AdvancedMarker position={userLocation} zIndex={800} anchorLeft="-50%" anchorTop="-50%" title="You">
            <span className="block size-4 rounded-full bg-sky-400 ring-4 ring-sky-400/30" />
          </AdvancedMarker>
        )}
        {popup && selectedGroup && (
          <AdvancedMarker
            position={{ lat: selectedGroup.venue.lat, lng: selectedGroup.venue.lng }}
            zIndex={2000}
            anchorLeft="-50%"
            anchorTop="calc(-100% - 3rem)"
          >
            {/* Keep clicks inside the card from reaching the map, which would close it. */}
            <div className="pin-enter w-80" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              {popup(selectedGroup)}
            </div>
          </AdvancedMarker>
        )}
      </Map>
      <LocateButton
        onLocation={props.onLocation}
        onError={props.onLocateError}
        className={props.locateClassName ?? 'bottom-6'}
      />
    </div>
  );
}
