import { describe, expect, it } from 'vitest';
import { isDealOn, isIsoDate, melbourneDate, weekdayOf, type DealSchedule } from './is-deal-on';

const SUN = 0;
const MON = 1;
const WED = 3;
const SAT = 6;

function deal(days: number[], valid_from: string | null = null, valid_until: string | null = null): DealSchedule {
  return { days, valid_from, valid_until };
}

describe('test environment', () => {
  it('runs in a device time zone other than Melbourne', () => {
    // vitest.config.ts sets TZ=America/Los_Angeles; Melbourne is never behind UTC.
    expect(new Date('2026-10-22T00:00:00Z').getTimezoneOffset()).toBeGreaterThan(0);
  });
});

describe('weekdayOf', () => {
  it.each([
    ['2026-10-22', 4], // Thursday
    ['2026-10-24', 6], // Saturday
    ['2026-10-25', 0], // Sunday
    ['2026-04-05', 0], // Sunday, daylight saving ends
    ['2026-10-04', 0], // Sunday, daylight saving starts
    ['2028-02-29', 2], // Tuesday, leap day
  ])('%s is weekday %i', (date, weekday) => {
    expect(weekdayOf(date)).toBe(weekday);
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => weekdayOf('2026-2-5')).toThrow(RangeError);
    expect(() => weekdayOf('2026-02-30')).toThrow(RangeError);
    expect(() => weekdayOf('')).toThrow(RangeError);
  });
});

describe('isIsoDate', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    expect(isIsoDate('2026-10-24')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('24/10/2026')).toBe(false);
    expect(isIsoDate('2026-10-24T00:00')).toBe(false);
  });
});

describe('isDealOn: weekday match', () => {
  it('is on when the weekday is in days', () => {
    expect(isDealOn(deal([SAT]), '2026-10-24')).toBe(true);
  });

  it('is off when the weekday is not in days', () => {
    expect(isDealOn(deal([SUN, MON, WED]), '2026-10-24')).toBe(false);
  });

  it('matches any of several days', () => {
    const wedAndSat = deal([WED, SAT]);
    expect(isDealOn(wedAndSat, '2026-10-21')).toBe(true); // Wed
    expect(isDealOn(wedAndSat, '2026-10-22')).toBe(false); // Thu
    expect(isDealOn(wedAndSat, '2026-10-24')).toBe(true); // Sat
  });

  it('is on every day when days holds all seven', () => {
    const everyDay = deal([0, 1, 2, 3, 4, 5, 6]);
    for (const date of ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']) {
      expect(isDealOn(everyDay, date)).toBe(true);
    }
  });

  it('is never on with no days', () => {
    expect(isDealOn(deal([]), '2026-10-24')).toBe(false);
  });
});

describe('isDealOn: valid-from and valid-until bounds', () => {
  const saturdays = deal([SAT], '2026-10-10', '2026-10-31');

  it('is off before valid_from', () => {
    expect(isDealOn(saturdays, '2026-10-03')).toBe(false);
  });

  it('includes valid_from itself', () => {
    expect(isDealOn(saturdays, '2026-10-10')).toBe(true);
  });

  it('is on between the bounds', () => {
    expect(isDealOn(saturdays, '2026-10-24')).toBe(true);
  });

  it('includes valid_until itself', () => {
    expect(isDealOn(saturdays, '2026-10-31')).toBe(true);
  });

  it('is off after valid_until', () => {
    expect(isDealOn(saturdays, '2026-11-07')).toBe(false);
  });

  it('treats a null valid_from as open-ended in the past', () => {
    const untilEndOfOctober = deal([SAT], null, '2026-10-31');
    expect(isDealOn(untilEndOfOctober, '2020-01-04')).toBe(true);
    expect(isDealOn(untilEndOfOctober, '2026-11-07')).toBe(false);
  });

  it('treats a null valid_until as open-ended in the future', () => {
    const fromMidOctober = deal([SAT], '2026-10-10', null);
    expect(isDealOn(fromMidOctober, '2026-10-03')).toBe(false);
    expect(isDealOn(fromMidOctober, '2030-01-05')).toBe(true);
  });

  it('compares across month and year boundaries', () => {
    const summer = deal([0, 1, 2, 3, 4, 5, 6], '2026-12-28', '2027-01-03');
    expect(isDealOn(summer, '2026-12-27')).toBe(false);
    expect(isDealOn(summer, '2026-12-31')).toBe(true);
    expect(isDealOn(summer, '2027-01-03')).toBe(true);
    expect(isDealOn(summer, '2027-01-04')).toBe(false);
  });
});

describe('isDealOn: one-off deals', () => {
  const oneOff = deal([SAT], '2026-10-24', '2026-10-24');

  it('is on its single date', () => {
    expect(isDealOn(oneOff, '2026-10-24')).toBe(true);
  });

  it('is off on the same weekday a week either side', () => {
    expect(isDealOn(oneOff, '2026-10-17')).toBe(false);
    expect(isDealOn(oneOff, '2026-10-31')).toBe(false);
  });

  it('is off on the neighbouring days', () => {
    expect(isDealOn(oneOff, '2026-10-23')).toBe(false);
    expect(isDealOn(oneOff, '2026-10-25')).toBe(false);
  });
});

describe('melbourneDate', () => {
  it('uses Melbourne time, not the device or UTC', () => {
    // 09:00 Fri 23 Oct in Melbourne (AEDT, UTC+11) is still Thu 22 Oct in UTC
    // and in Los Angeles.
    expect(melbourneDate(new Date('2026-10-22T22:00:00Z'))).toBe('2026-10-23');
  });

  it('defaults to now', () => {
    expect(isIsoDate(melbourneDate())).toBe(true);
  });
});

describe('daylight saving ends: Sunday 5 April 2026 (03:00 AEDT -> 02:00 AEST)', () => {
  const sundayRoast = deal([SUN]);

  it('is still Saturday at 23:59 AEDT', () => {
    const date = melbourneDate(new Date('2026-04-04T12:59:00Z'));
    expect(date).toBe('2026-04-04');
    expect(isDealOn(sundayRoast, date)).toBe(false);
  });

  it('is Sunday from midnight AEDT (UTC+11)', () => {
    const date = melbourneDate(new Date('2026-04-04T13:00:00Z'));
    expect(date).toBe('2026-04-05');
    expect(isDealOn(sundayRoast, date)).toBe(true);
  });

  it('is Sunday during the repeated 02:00-03:00 hour', () => {
    expect(melbourneDate(new Date('2026-04-04T15:30:00Z'))).toBe('2026-04-05'); // 02:30 AEDT
    expect(melbourneDate(new Date('2026-04-04T16:30:00Z'))).toBe('2026-04-05'); // 02:30 AEST
  });

  it('is still Sunday at 23:59 AEST (UTC+10), an hour later in UTC than the day before', () => {
    const date = melbourneDate(new Date('2026-04-05T13:59:00Z'));
    expect(date).toBe('2026-04-05');
    expect(isDealOn(sundayRoast, date)).toBe(true);
  });

  it('is Monday from midnight AEST', () => {
    const date = melbourneDate(new Date('2026-04-05T14:00:00Z'));
    expect(date).toBe('2026-04-06');
    expect(isDealOn(sundayRoast, date)).toBe(false);
  });
});

describe('daylight saving starts: Sunday 4 October 2026 (02:00 AEST -> 03:00 AEDT)', () => {
  const sundayRoast = deal([SUN]);

  it('is still Saturday at 23:59 AEST', () => {
    const date = melbourneDate(new Date('2026-10-03T13:59:00Z'));
    expect(date).toBe('2026-10-03');
    expect(isDealOn(sundayRoast, date)).toBe(false);
  });

  it('is Sunday from midnight AEST (UTC+10)', () => {
    const date = melbourneDate(new Date('2026-10-03T14:00:00Z'));
    expect(date).toBe('2026-10-04');
    expect(isDealOn(sundayRoast, date)).toBe(true);
  });

  it('is Sunday either side of the skipped hour', () => {
    expect(melbourneDate(new Date('2026-10-03T15:59:00Z'))).toBe('2026-10-04'); // 01:59 AEST
    expect(melbourneDate(new Date('2026-10-03T16:00:00Z'))).toBe('2026-10-04'); // 03:00 AEDT
  });

  it('is still Sunday at 23:59 AEDT (UTC+11), an hour earlier in UTC than the day before', () => {
    const date = melbourneDate(new Date('2026-10-04T12:59:00Z'));
    expect(date).toBe('2026-10-04');
    expect(isDealOn(sundayRoast, date)).toBe(true);
  });

  it('is Monday from midnight AEDT', () => {
    const date = melbourneDate(new Date('2026-10-04T13:00:00Z'));
    expect(date).toBe('2026-10-05');
    expect(isDealOn(sundayRoast, date)).toBe(false);
  });

  it('keeps a valid_until on the change day inclusive', () => {
    const endsOnChangeDay = deal([SUN], null, '2026-10-04');
    expect(isDealOn(endsOnChangeDay, melbourneDate(new Date('2026-10-04T12:59:00Z')))).toBe(true);
    expect(isDealOn(endsOnChangeDay, '2026-10-11')).toBe(false);
  });
});
