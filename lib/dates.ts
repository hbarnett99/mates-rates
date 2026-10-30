import { isIsoDate, melbourneDate, weekdayOf, type IsoDate } from './deals/is-deal-on';

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Weekday toggles in the order the form shows them: M T W T F S S. */
export const WEEKDAYS_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

function toUtc(date: IsoDate): Date {
  if (!isIsoDate(date)) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

/** Calendar arithmetic on a YYYY-MM-DD date. Independent of time zones. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const utc = toUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** The date to show for a ?date= value: itself if valid, otherwise today in Melbourne. */
export function resolveDateParam(value: string | string[] | undefined, now: Date = new Date()): IsoDate {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw !== undefined && isIsoDate(raw) ? raw : melbourneDate(now);
}

export type DateChip = { date: IsoDate; label: string };

/** Today, Tomorrow, then the next five days by name ("Sat 24"). */
export function dateChips(today: IsoDate): DateChip[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : shortDayLabel(date);
    return { date, label };
  });
}

/** "Sat 24". */
export function shortDayLabel(date: IsoDate): string {
  return `${SHORT_WEEKDAYS[weekdayOf(date)]} ${toUtc(date).getUTCDate()}`;
}

/** "Sat 24 Oct", with the year added when it isn't the reference year. */
export function longDayLabel(date: IsoDate, today: IsoDate): string {
  const utc = toUtc(date);
  const base = `${shortDayLabel(date)} ${MONTHS[utc.getUTCMonth()]}`;
  return date.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${utc.getUTCFullYear()}`;
}

const melbourneDayFormat = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Melbourne',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "22 Oct 2026" for a timestamp, in Melbourne time. */
export function formatMelbourneDay(timestamp: string): string {
  return melbourneDayFormat.format(new Date(timestamp));
}

/** "Wed, Sun", "Every day", "Weekdays" or "Weekends", Monday first. */
export function daysLabel(days: readonly number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return WEEKDAYS_MONDAY_FIRST.filter((d) => set.has(d))
    .map((d) => SHORT_WEEKDAYS[d])
    .join(', ');
}
