import { describe, expect, it } from 'vitest';
import { addDays, daysInMonth, isValidDate, today, weekdayOf } from '../src/index.js';

describe('dates', () => {
  it('knows the weekday of any date', () => {
    expect(weekdayOf('1970-01-01')).toBe(4);
    expect(weekdayOf('2024-02-29')).toBe(4);
    expect(weekdayOf('2026-11-03')).toBe(2);
    expect(weekdayOf('2026-11-08')).toBe(7);
    expect(weekdayOf('1969-12-31')).toBe(3);
  });

  it('adds days across months, years and leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('2023-12-31', 1)).toBe('2024-01-01');
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
    expect(addDays('2026-03-08', 365)).toBe('2027-03-08');
  });

  it('counts days in a month', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('rejects dates that do not exist', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-1-01')).toBe(false);
    expect(isValidDate('2026-11-03T10:00:00Z')).toBe(false);
    expect(isValidDate(20261103)).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });

  it('gives today in a given time zone', () => {
    const instant = new Date('2026-11-03T20:00:00Z');
    expect(today('Asia/Tokyo', instant)).toBe('2026-11-04');
    expect(today('America/New_York', instant)).toBe('2026-11-03');
    expect(today('UTC', instant)).toBe('2026-11-03');
  });
});
