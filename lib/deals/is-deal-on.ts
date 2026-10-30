const MELBOURNE = 'Australia/Melbourne';

/** A calendar date as "YYYY-MM-DD", e.g. "2026-10-24". */
export type IsoDate = string;

/** The columns of a deals row that decide which dates it runs on. */
export type DealSchedule = {
  /** Weekdays, 0 = Sunday to 6 = Saturday. */
  days: readonly number[];
  valid_from: IsoDate | null;
  valid_until: IsoDate | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Round-trip through UTC to reject dates like 2026-02-30.
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function isIsoDate(value: string): value is IsoDate {
  return parseIsoDate(value) !== null;
}

/**
 * Weekday of a calendar date, 0 = Sunday to 6 = Saturday.
 *
 * A calendar date's weekday is the same in every time zone, so this works on
 * the date itself in UTC and never touches the device clock. Time zones only
 * matter when turning an instant into a date; see melbourneDate.
 */
export function weekdayOf(date: IsoDate): number {
  const parts = parseIsoDate(date);
  if (!parts) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

const melbourneDateFormat = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in Melbourne at the given instant (defaults to now). */
export function melbourneDate(instant: Date = new Date()): IsoDate {
  const parts = melbourneDateFormat.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Intl.DateTimeFormat returned no ${type}`);
    return part.value;
  };
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Whether a deal runs on a Melbourne calendar date: the date's weekday is in
 * `days`, and the date is within valid_from..valid_until (inclusive; null
 * means open-ended).
 */
export function isDealOn(deal: DealSchedule, date: IsoDate): boolean {
  if (deal.valid_from !== null && date < deal.valid_from) return false;
  if (deal.valid_until !== null && date > deal.valid_until) return false;
  return deal.days.includes(weekdayOf(date));
}
