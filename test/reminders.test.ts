import { describe, expect, it } from 'vitest';
import { createCalendar, reminderDates } from '../src/index.js';

describe('reminderDates', () => {
  it('counts back in business days by default', () => {
    expect(reminderDates('2026-11-20', [1, 3, 7])).toEqual(['2026-11-11', '2026-11-17', '2026-11-19']);
  });

  it('can count calendar days instead', () => {
    expect(reminderDates('2026-11-20', [7, 0], { unit: 'calendarDays' })).toEqual(['2026-11-13', '2026-11-20']);
  });

  it('skips holidays and removes duplicates', () => {
    const calendar = createCalendar({ holidays: ['2026-12-25'] });
    expect(reminderDates('2026-12-28', [1, 1, 2], { calendar })).toEqual(['2026-12-23', '2026-12-24']);
  });

  it('rejects negative or fractional offsets', () => {
    expect(() => reminderDates('2026-11-20', [-1])).toThrow(RangeError);
    expect(() => reminderDates('2026-11-20', [1.5])).toThrow(RangeError);
  });
});
