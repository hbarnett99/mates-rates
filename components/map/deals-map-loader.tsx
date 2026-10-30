'use client';

import dynamic from 'next/dynamic';

/** A dark shell that paints straight away, before the map script loads. */
export function MapShell() {
  return <div className="h-full w-full bg-[#1a1d23]" aria-hidden="true" />;
}

/** The map runs only in the browser; the list beside it is server-rendered. */
export const DealsMapLoader = dynamic(() => import('./deals-map'), { ssr: false, loading: MapShell });
