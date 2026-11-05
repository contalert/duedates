import { describe, expect, it } from 'vitest';
import { createCalendar, now } from '../src/index.js';

// Friday 6 Nov 2026, Saturday 7, Sunday 8, Monday 9, Tuesday 10.
describe('business hours', () => {
  const nineToFive = createCalendar();

  it('carries the remainder over to the next business day', () => {
    expect(nineToFive.addBusinessHours('2026-11-06T15:00', 4)).toBe('2026-11-09T11:00');
  });

  it('starts counting at the next opening when outside working hours', () => {
    expect(nineToFive.addBusinessHours('2026-11-09T07:30', 1)).toBe('2026-11-09T10:00');
    expect(nineToFive.addBusinessMinutes('2026-11-09T18:00', 30)).toBe('2026-11-10T09:30');
    expect(nineToFive.addBusinessHours('2026-11-07T10:00', 1)).toBe('2026-11-09T10:00');
  });

  it('stops at closing time instead of jumping to the next day', () => {
    expect(nineToFive.addBusinessHours('2026-11-09T09:00', 8)).toBe('2026-11-09T17:00');
    expect(nineToFive.addBusinessHours('2026-11-09T17:00', 1)).toBe('2026-11-10T10:00');
  });

  it('accepts fractional hours that add up to whole minutes', () => {
    expect(nineToFive.addBusinessHours('2026-11-09T09:00', 1.5)).toBe('2026-11-09T10:30');
    expect(() => nineToFive.addBusinessHours('2026-11-09T09:00', 1 / 7)).toThrow(RangeError);
  });

  it('counts backwards with negative values', () => {
    expect(nineToFive.addBusinessHours('2026-11-09T10:00', -2)).toBe('2026-11-06T16:00');
    expect(nineToFive.addBusinessHours('2026-11-09T17:00', -8)).toBe('2026-11-09T09:00');
  });

  it('returns the same moment for zero', () => {
    expect(nineToFive.addBusinessMinutes('2026-11-07T22:15', 0)).toBe('2026-11-07T22:15');
  });

  it('skips breaks between ranges', () => {
    const withLunch = createCalendar({ workingHours: [['09:00', '12:00'], ['13:00', '18:00']] });
    expect(withLunch.addBusinessHours('2026-11-09T11:00', 2)).toBe('2026-11-09T14:00');
    expect(withLunch.isWithinBusinessHours('2026-11-09T12:30')).toBe(false);
  });

  it('skips holidays', () => {
    const calendar = createCalendar({ holidays: ['2026-11-09'] });
    expect(calendar.addBusinessHours('2026-11-06T16:00', 2)).toBe('2026-11-10T10:00');
  });

  it('supports different hours per weekday', () => {
    const shortFriday = createCalendar({
      workingHours: {
        1: [['09:00', '18:00']],
        2: [['09:00', '18:00']],
        3: [['09:00', '18:00']],
        4: [['09:00', '18:00']],
        5: [['09:00', '13:00']],
      },
    });
    expect(shortFriday.addBusinessHours('2026-11-06T12:00', 2)).toBe('2026-11-09T10:00');
    expect(shortFriday.isWithinBusinessHours('2026-11-06T14:00')).toBe(false);
  });

  it('handles round-the-clock calendars and midnight', () => {
    const alwaysOpen = createCalendar({ weekend: [], workingHours: [['00:00', '24:00']] });
    expect(alwaysOpen.addBusinessMinutes('2026-11-07T23:30', 60)).toBe('2026-11-08T00:30');
    expect(alwaysOpen.addBusinessMinutes('2026-11-07T23:00', 60)).toBe('2026-11-08T00:00');
    expect(alwaysOpen.businessMinutesBetween('2026-11-07T00:00', '2026-11-08T00:00')).toBe(1440);
  });

  it('counts working minutes between two moments', () => {
    expect(nineToFive.businessMinutesBetween('2026-11-06T15:00', '2026-11-09T11:00')).toBe(240);
    expect(nineToFive.businessMinutesBetween('2026-11-09T11:00', '2026-11-06T15:00')).toBe(-240);
    expect(nineToFive.businessMinutesBetween('2026-11-07T10:00', '2026-11-08T10:00')).toBe(0);
    expect(nineToFive.businessMinutesBetween('2026-11-08T10:00', '2026-11-07T10:00')).toBe(0);
  });

  it('knows whether a moment is within working hours', () => {
    expect(nineToFive.isWithinBusinessHours('2026-11-09T09:00')).toBe(true);
    expect(nineToFive.isWithinBusinessHours('2026-11-09T16:59')).toBe(true);
    expect(nineToFive.isWithinBusinessHours('2026-11-09T17:00')).toBe(false);
    expect(nineToFive.isWithinBusinessHours('2026-11-07T10:00')).toBe(false);
  });

  it('rejects invalid working hours and moments', () => {
    expect(() => createCalendar({ workingHours: [['09:00', '12:00'], ['11:00', '18:00']] })).toThrow(RangeError);
    expect(() => createCalendar({ workingHours: [['18:00', '09:00']] })).toThrow(RangeError);
    expect(() => createCalendar({ workingHours: [['09:00', '25:00']] })).toThrow(RangeError);
    expect(() => createCalendar({ workingHours: { 8: [['09:00', '17:00']] } as never })).toThrow(RangeError);
    expect(() => nineToFive.addBusinessHours('2026-11-09 10:00', 1)).toThrow(RangeError);
    expect(() => nineToFive.addBusinessHours('2026-11-09T24:00', 1)).toThrow(RangeError);
    expect(() => nineToFive.addBusinessMinutes('2026-11-09T10:00', 1.5)).toThrow(RangeError);
    const neverOpen = createCalendar({ workingHours: {} });
    expect(() => neverOpen.addBusinessHours('2026-11-09T10:00', 1)).toThrow(RangeError);
  });
});

describe('now', () => {
  it('gives the wall-clock moment in a time zone', () => {
    const instant = new Date('2026-11-03T20:00:00Z');
    expect(now('Asia/Tokyo', instant)).toBe('2026-11-04T05:00');
    expect(now('America/New_York', instant)).toBe('2026-11-03T15:00');
    expect(now('UTC', new Date('2026-11-03T00:05:00Z'))).toBe('2026-11-03T00:05');
  });
});
