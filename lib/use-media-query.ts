'use client';

import { useSyncExternalStore } from 'react';

/** Matches the spec's desktop breakpoint (Tailwind's `lg`). */
export const DESKTOP_QUERY = '(min-width: 1024px)';

/** Whether a media query matches. False during server rendering. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
