import { describe, expect, it } from 'vitest';
import { validateDealInput } from './input';

const valid = {
  venue: { kind: 'existing', id: 'v1' },
  title: '  Parma + pot ',
  priceCents: 2800,
  category: 'food',
  days: [3, 3, 0],
  startTime: '',
  endTime: null,
  validFrom: null,
  validUntil: null,
  notes: ' ',
  tags: ['pints'],
  dismissedTags: [],
};

describe('validateDealInput', () => {
  it('accepts a valid deal and tidies it', () => {
    const result = validateDealInput(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        ...valid,
        title: 'Parma + pot',
        days: [0, 3],
        startTime: null,
        notes: null,
      },
    });
  });

  it('accepts a Google place and a dropped pin', () => {
    const place = { kind: 'place', googlePlaceId: 'ChIJ123', name: 'Corner Hotel', suburb: 'Richmond', lat: -37.82, lng: 144.99 };
    expect(validateDealInput({ ...valid, venue: place }).ok).toBe(true);
    const pin = { kind: 'pin', name: 'Food truck', suburb: null, lat: -37.82, lng: 144.99 };
    expect(validateDealInput({ ...valid, venue: pin }).ok).toBe(true);
  });

  it.each([
    ['no venue', { venue: null }, 'Pick a venue.'],
    ['a pin with no name', { venue: { kind: 'pin', name: ' ', lat: -37, lng: 144 } }, 'Give the venue a name.'],
    ['a pin off the planet', { venue: { kind: 'pin', name: 'X', lat: 200, lng: 144 } }, 'Drop a pin for the venue.'],
    ['a place with no id', { venue: { kind: 'place', name: 'X', lat: -37, lng: 144 } }, 'Pick a venue.'],
    ['an empty title', { title: '   ' }, 'Give the deal a title.'],
    ['a float price', { priceCents: 12.5 }, 'Enter a price, like 35 or 12.50.'],
    ['a negative price', { priceCents: -100 }, 'Enter a price, like 35 or 12.50.'],
    ['an unknown category', { category: 'snack' }, 'Pick food, drink or both.'],
    ['no days', { days: [] }, 'Pick the days it runs.'],
    ['a day out of range', { days: [7] }, 'Pick the days it runs.'],
    ['a bad time', { startTime: '5pm' }, 'Times need to look like 17:00.'],
    ['a bad date', { validFrom: '2026-02-30' }, 'Those dates don’t look right.'],
    ['dates the wrong way round', { validFrom: '2026-10-24', validUntil: '2026-10-23' }, 'The end date is before the start date.'],
    ['non-string tags', { tags: [1] }, 'Those tags don’t look right.'],
  ])('rejects %s', (_, override, error) => {
    expect(validateDealInput({ ...valid, ...override })).toEqual({ ok: false, error });
  });

  it('accepts a one-off date range', () => {
    expect(validateDealInput({ ...valid, validFrom: '2026-10-24', validUntil: '2026-10-24' }).ok).toBe(true);
  });

  it('rejects input that is not an object', () => {
    expect(validateDealInput('nope').ok).toBe(false);
    expect(validateDealInput(null).ok).toBe(false);
  });
});
