import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceMetres, MELBOURNE_CENTRE } from './geo';

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    expect(distanceMetres(MELBOURNE_CENTRE, MELBOURNE_CENTRE)).toBe(0);
  });

  it('measures Melbourne CBD to Fitzroy at about 2.5 km', () => {
    const fitzroy = { lat: -37.7983, lng: 144.9784 };
    expect(distanceMetres(MELBOURNE_CENTRE, fitzroy)).toBeGreaterThan(2000);
    expect(distanceMetres(MELBOURNE_CENTRE, fitzroy)).toBeLessThan(2500);
  });
});

describe('directionsUrl', () => {
  it('includes the place id when there is one', () => {
    const url = new URL(directionsUrl({ lat: -37.8, lng: 144.9, google_place_id: 'abc' }));
    expect(url.searchParams.get('destination')).toBe('-37.8,144.9');
    expect(url.searchParams.get('destination_place_id')).toBe('abc');
  });

  it('works for a dropped pin', () => {
    const url = new URL(directionsUrl({ lat: -37.8, lng: 144.9, google_place_id: null }));
    expect(url.searchParams.has('destination_place_id')).toBe(false);
  });
});
