import { describe, expect, it } from 'vitest';
import { createCalendar } from '../src/index.js';

describe('createCalendar', () => {
  const weekendsOnly = createCalendar();
  const withChristmas = createCalendar({ holidays: ['2026-12-25'] });

  it('treats Saturday and Sunday as the weekend by default', () => {
    expect(weekendsOnly.isWeekend('2026-11-07')).toBe(true);
    expect(weekendsOnly.isWeekend('2026-11-08')).toBe(true);
    expect(weekendsOnly.isBusinessDay('2026-11-09')).toBe(true);
  });

  it('supports other weekends', () => {
    const fridaySaturday = createCalendar({ weekend: [5, 6] });
    expect(fridaySaturday.isBusinessDay('2026-11-06')).toBe(false);
    expect(fridaySaturday.isBusinessDay('2026-11-08')).toBe(true);
  });

  it('accepts holidays as a list or a function', () => {
    expect(withChristmas.isHoliday('2026-12-25')).toBe(true);
    expect(withChristmas.isBusinessDay('2026-12-25')).toBe(false);
    const firstOfMonth = createCalendar({ holidays: (date) => date.endsWith('-01') });
    expect(firstOfMonth.isBusinessDay('2026-12-01')).toBe(false);
    expect(firstOfMonth.isBusinessDay('2026-12-02')).toBe(true);
  });

  it('adjusts with every convention', () => {
    // Saturday 7 Nov 2026
    expect(weekendsOnly.adjust('2026-11-07', 'none')).toBe('2026-11-07');
    expect(weekendsOnly.adjust('2026-11-07', 'following')).toBe('2026-11-09');
    expect(weekendsOnly.adjust('2026-11-07', 'preceding')).toBe('2026-11-06');
    // Saturday 31 Jan 2026: following would land in February
    expect(weekendsOnly.adjust('2026-01-31', 'modifiedFollowing')).toBe('2026-01-30');
    // Sunday 1 Nov 2026: preceding would land in October
    expect(weekendsOnly.adjust('2026-11-01', 'modifiedPreceding')).toBe('2026-11-02');
    // Business days stay put
    expect(weekendsOnly.adjust('2026-11-03', 'modifiedFollowing')).toBe('2026-11-03');
    // Holidays count too
    expect(withChristmas.adjust('2026-12-25', 'following')).toBe('2026-12-28');
  });

  it('adds and subtracts business days', () => {
    expect(withChristmas.addBusinessDays('2026-12-24', 1)).toBe('2026-12-28');
    expect(withChristmas.addBusinessDays('2026-12-28', -1)).toBe('2026-12-24');
    expect(weekendsOnly.addBusinessDays('2026-11-06', 5)).toBe('2026-11-13');
    expect(weekendsOnly.addBusinessDays('2026-11-07', 0)).toBe('2026-11-07');
  });

  it('counts business days between two dates', () => {
    expect(weekendsOnly.businessDaysBetween('2026-11-02', '2026-11-09')).toBe(5);
    expect(weekendsOnly.businessDaysBetween('2026-11-09', '2026-11-02')).toBe(-5);
    expect(weekendsOnly.businessDaysBetween('2026-11-07', '2026-11-08')).toBe(0);
    expect(weekendsOnly.businessDaysBetween('2026-11-08', '2026-11-07')).toBe(0);
  });

  it('rejects broken configurations', () => {
    expect(() => createCalendar({ weekend: [1, 2, 3, 4, 5, 6, 7] })).toThrow(RangeError);
    expect(() => createCalendar({ weekend: [0 as never] })).toThrow(RangeError);
    expect(() => createCalendar({ holidays: ['25/12/2026'] })).toThrow(RangeError);
    const neverOpen = createCalendar({ holidays: () => true });
    expect(() => neverOpen.adjust('2026-11-07', 'following')).toThrow(RangeError);
    expect(() => weekendsOnly.adjust('2026-11-07', 'nearest' as never)).toThrow(RangeError);
  });
});
