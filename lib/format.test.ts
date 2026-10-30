import { describe, expect, it } from 'vitest';
import { formatDistance, formatPrice, formatTime, formatTimeWindow, parsePriceToCents, toTimeInput } from './format';

describe('formatPrice', () => {
  it('drops cents for whole dollars', () => {
    expect(formatPrice(3500)).toBe('$35');
    expect(formatPrice(0)).toBe('$0');
  });

  it('shows two decimals otherwise', () => {
    expect(formatPrice(1250)).toBe('$12.50');
    expect(formatPrice(905)).toBe('$9.05');
  });
});

describe('parsePriceToCents', () => {
  it.each([
    ['35', 3500],
    ['$35', 3500],
    ['12.5', 1250],
    ['12.50', 1250],
    ['$ 9.05', 905],
    ['0', 0],
    [' 28 ', 2800],
  ])('%j -> %i', (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '-5', '12.345', '1,000', '$'])('rejects %j', (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });
});

describe('times', () => {
  it('formats times of day', () => {
    expect(formatTime('17:00:00')).toBe('5pm');
    expect(formatTime('17:30')).toBe('5:30pm');
    expect(formatTime('00:00')).toBe('12am');
    expect(formatTime('12:00')).toBe('12pm');
    expect(formatTime('09:15')).toBe('9:15am');
  });

  it('formats time windows', () => {
    expect(formatTimeWindow('16:00:00', '19:00:00')).toBe('4pm–7pm');
    expect(formatTimeWindow('16:00', null)).toBe('From 4pm');
    expect(formatTimeWindow(null, '19:00')).toBe('Until 7pm');
    expect(formatTimeWindow(null, null)).toBe('All day');
  });

  it('trims seconds for time inputs', () => {
    expect(toTimeInput('17:00:00')).toBe('17:00');
    expect(toTimeInput(null)).toBe('');
  });
});

describe('formatDistance', () => {
  it('uses metres under 1 km and kilometres above', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1234)).toBe('1.2 km');
    expect(formatDistance(12_400)).toBe('12 km');
  });
});
