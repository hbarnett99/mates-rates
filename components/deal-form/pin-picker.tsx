'use client';

import { AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import { googleMapId } from '@/lib/env';
import type { LatLng } from '@/lib/geo';

type Props = {
  centre: LatLng;
  value: LatLng | null;
  onChange: (position: LatLng) => void;
};

/** A small map for placing a venue by hand: tap to drop the pin, drag to adjust. */
export default function PinPicker({ centre, value, onChange }: Props) {
  return (
    <div className="h-56 overflow-hidden rounded-xl ring-1 ring-line">
      <Map
        id="pin-picker"
        mapId={googleMapId()}
        colorScheme="DARK"
        renderingType="VECTOR"
        defaultCenter={value ?? centre}
        defaultZoom={16}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        className="h-full w-full"
        onClick={(e) => {
          if (e.detail.latLng) onChange(e.detail.latLng);
        }}
      >
        {value && (
          <AdvancedMarker
            position={value}
            draggable
            onDragEnd={(e) => {
              const position = e.latLng?.toJSON();
              if (position) onChange(position);
            }}
          >
            <span className="block size-6 rounded-full border-4 border-text bg-accent shadow-lg" />
          </AdvancedMarker>
        )}
      </Map>
    </div>
  );
}
