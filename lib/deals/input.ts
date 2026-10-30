import type { DealCategory } from '@/lib/db/types';
import { isIsoDate } from './is-deal-on';

/** Which venue a deal is for, as chosen in the form. */
export type VenueInput =
  | { kind: 'existing'; id: string }
  | { kind: 'place'; googlePlaceId: string; name: string; suburb: string | null; lat: number; lng: number }
  | { kind: 'pin'; name: string; suburb: string | null; lat: number; lng: number };

/** What the add/edit form sends to the Server Actions. */
export type DealInput = {
  venue: VenueInput;
  title: string;
  priceCents: number;
  category: DealCategory;
  days: number[];
  /** "HH:MM", Melbourne time, or null. */
  startTime: string | null;
  endTime: string | null;
  validFrom: string | null;
  validUntil: string | null;
  notes: string | null;
  /** Tags picked by hand. Keyword rules add more on save. */
  tags: string[];
  /** Rule tags the person untapped, so the rules don't add them back. */
  dismissedTags: string[];
};

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const CATEGORIES: readonly string[] = ['food', 'drink', 'both'] satisfies DealCategory[];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_TITLE = 120;
const MAX_NOTES = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function coordinates(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function validateVenue(value: unknown): Validated<VenueInput> {
  if (!isRecord(value)) return { ok: false, error: 'Pick a venue.' };
  if (value.kind === 'existing') {
    return typeof value.id === 'string' && value.id !== ''
      ? { ok: true, value: { kind: 'existing', id: value.id } }
      : { ok: false, error: 'Pick a venue.' };
  }
  if (value.kind !== 'place' && value.kind !== 'pin') return { ok: false, error: 'Pick a venue.' };

  const name = optionalText(value.name);
  if (!name) return { ok: false, error: 'Give the venue a name.' };
  const position = coordinates(value.lat, value.lng);
  if (!position) return { ok: false, error: 'Drop a pin for the venue.' };
  const suburb = optionalText(value.suburb);
  if (value.kind === 'pin') {
    return { ok: true, value: { kind: 'pin', name, suburb, ...position } };
  }
  if (typeof value.googlePlaceId !== 'string' || value.googlePlaceId === '') {
    return { ok: false, error: 'Pick a venue.' };
  }
  return { ok: true, value: { kind: 'place', googlePlaceId: value.googlePlaceId, name, suburb, ...position } };
}

/** Checks a deal from the form. Server Actions get untrusted input, so check everything. */
export function validateDealInput(value: unknown): Validated<DealInput> {
  if (!isRecord(value)) return { ok: false, error: 'Something went wrong. Try again.' };

  const venue = validateVenue(value.venue);
  if (!venue.ok) return venue;

  const title = optionalText(value.title);
  if (!title) return { ok: false, error: 'Give the deal a title.' };
  if (title.length > MAX_TITLE) return { ok: false, error: `Keep the title under ${MAX_TITLE} characters.` };

  const priceCents = value.priceCents;
  if (typeof priceCents !== 'number' || !Number.isInteger(priceCents) || priceCents < 0 || priceCents > 10_000_00) {
    return { ok: false, error: 'Enter a price, like 35 or 12.50.' };
  }

  const category = value.category;
  if (typeof category !== 'string' || !CATEGORIES.includes(category)) {
    return { ok: false, error: 'Pick food, drink or both.' };
  }

  const rawDays = value.days;
  if (!Array.isArray(rawDays) || !rawDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return { ok: false, error: 'Pick the days it runs.' };
  }
  const days = [...new Set(rawDays as number[])].sort((a, b) => a - b);
  if (days.length === 0) return { ok: false, error: 'Pick the days it runs.' };

  const startTime = optionalText(value.startTime);
  const endTime = optionalText(value.endTime);
  if ((startTime && !TIME.test(startTime)) || (endTime && !TIME.test(endTime))) {
    return { ok: false, error: 'Times need to look like 17:00.' };
  }

  const validFrom = optionalText(value.validFrom);
  const validUntil = optionalText(value.validUntil);
  if ((validFrom && !isIsoDate(validFrom)) || (validUntil && !isIsoDate(validUntil))) {
    return { ok: false, error: 'Those dates don’t look right.' };
  }
  if (validFrom && validUntil && validFrom > validUntil) {
    return { ok: false, error: 'The end date is before the start date.' };
  }

  const notes = optionalText(value.notes);
  if (notes && notes.length > MAX_NOTES) return { ok: false, error: `Keep notes under ${MAX_NOTES} characters.` };

  const tags = value.tags ?? [];
  const dismissedTags = value.dismissedTags ?? [];
  if (!isStringArray(tags) || !isStringArray(dismissedTags)) return { ok: false, error: 'Those tags don’t look right.' };

  return {
    ok: true,
    value: {
      venue: venue.value,
      title,
      priceCents,
      category: category as DealCategory,
      days,
      startTime,
      endTime,
      validFrom,
      validUntil,
      notes,
      tags,
      dismissedTags,
    },
  };
}
