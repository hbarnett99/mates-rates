import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateChips,
  daysLabel,
  formatMelbourneDay,
  longDayLabel,
  resolveDateParam,
  shortDayLabel,
} from './dates';

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is unaffected by daylight-saving change days', () => {
    expect(addDays('2026-04-04', 1)).toBe('2026-04-05');
    expect(addDays('2026-04-05', 1)).toBe('2026-04-06');
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04');
    expect(addDays('2026-10-04', 1)).toBe('2026-10-05');
  });
});

describe('resolveDateParam', () => {
  const now = new Date('2026-10-22T22:00:00Z'); // 09:00 Fri 23 Oct in Melbourne

  it('uses a valid ?date=', () => {
    expect(resolveDateParam('2026-12-25', now)).toBe('2026-12-25');
    expect(resolveDateParam(['2026-12-25', '2026-12-26'], now)).toBe('2026-12-25');
  });

  it('falls back to today in Melbourne', () => {
    expect(resolveDateParam(undefined, now)).toBe('2026-10-23');
    expect(resolveDateParam('tomorrow', now)).toBe('2026-10-23');
    expect(resolveDateParam('2026-02-30', now)).toBe('2026-10-23');
  });
});

describe('dateChips', () => {
  it('shows Today, Tomorrow, then five named days', () => {
    expect(dateChips('2026-10-22').map((c) => c.label)).toEqual([
      'Today',
      'Tomorrow',
      'Sat 24',
      'Sun 25',
      'Mon 26',
      'Tue 27',
      'Wed 28',
    ]);
    expect(dateChips('2026-10-22')[6]?.date).toBe('2026-10-28');
  });
});

describe('labels', () => {
  it('formats short and long day labels', () => {
    expect(shortDayLabel('2026-10-24')).toBe('Sat 24');
    expect(longDayLabel('2026-10-24', '2026-10-22')).toBe('Sat 24 Oct');
    expect(longDayLabel('2027-01-02', '2026-10-22')).toBe('Sat 2 Jan 2027');
  });

  it('formats a timestamp as a Melbourne day', () => {
    // 23:30 UTC on 21 Oct is 10:30 on 22 Oct in Melbourne.
    expect(formatMelbourneDay('2026-10-21T23:30:00Z')).toBe('22 Oct 2026');
  });

  it('describes the days a deal runs, Monday first', () => {
    expect(daysLabel([0, 3])).toBe('Wed, Sun');
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysLabel([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysLabel([6, 0])).toBe('Weekends');
    expect(daysLabel([5])).toBe('Fri');
  });
});
