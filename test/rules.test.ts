import { describe, expect, it } from 'vitest';
import { createCalendar, nextDue, occurrences } from '../src/index.js';

describe('occurrences', () => {
  it('moves a fixed day of the month to the next business day', () => {
    expect(occurrences({ type: 'dayOfMonth', day: 20, adjust: 'following' }, { from: '2026-11-03', count: 3 })).toEqual([
      { nominal: '2026-11-20', due: '2026-11-20' },
      { nominal: '2026-12-20', due: '2026-12-21' },
      { nominal: '2027-01-20', due: '2027-01-20' },
    ]);
  });

  it('includes a date from last month that was adjusted into range', () => {
    // Saturday 31 Oct 2026 → Monday 2 Nov 2026
    expect(nextDue({ type: 'dayOfMonth', day: 31, adjust: 'following' }, { from: '2026-11-02' })).toEqual({
      nominal: '2026-10-31',
      due: '2026-11-02',
    });
  });

  it('clamps days past the end of the month', () => {
    expect(nextDue({ type: 'dayOfMonth', day: 31 }, { from: '2027-02-01' })?.due).toBe('2027-02-28');
    expect(nextDue({ type: 'dayOfMonth', day: 31 }, { from: '2028-02-01' })?.due).toBe('2028-02-29');
  });

  it('filters by month for quarterly and yearly deadlines', () => {
    const quarterEnds = occurrences({ type: 'dayOfMonth', day: 'last', months: [3, 6, 9, 12] }, { from: '2026-11-03', count: 2 });
    expect(quarterEnds.map((o) => o.due)).toEqual(['2026-12-31', '2027-03-31']);
    const yearly = occurrences({ type: 'dayOfMonth', day: 15, months: [4] }, { from: '2026-11-03', count: 2 });
    expect(yearly.map((o) => o.due)).toEqual(['2027-04-15', '2028-04-15']);
  });

  it('stops at `to`', () => {
    const monthly = occurrences({ type: 'dayOfMonth', day: 10 }, { from: '2026-01-01', to: '2026-12-31' });
    expect(monthly).toHaveLength(12);
    expect(monthly[11]?.due).toBe('2026-12-10');
    expect(occurrences({ type: 'dayOfMonth', day: 10 }, { from: '2026-01-01', to: '2026-12-31', count: 2 })).toHaveLength(2);
  });

  it('finds the nth or last weekday of the month', () => {
    expect(nextDue({ type: 'weekdayOfMonth', weekday: 2, nth: 2 }, { from: '2026-11-01' })?.due).toBe('2026-11-10');
    expect(nextDue({ type: 'weekdayOfMonth', weekday: 5, nth: -1 }, { from: '2026-11-01' })?.due).toBe('2026-11-27');
    // November 2026 has only four Tuesdays; December has five.
    expect(nextDue({ type: 'weekdayOfMonth', weekday: 2, nth: 5 }, { from: '2026-11-01' })?.due).toBe('2026-12-29');
  });

  it('finds the nth business day of the month, counting holidays', () => {
    expect(nextDue({ type: 'businessDayOfMonth', n: 5 }, { from: '2026-11-01' })?.due).toBe('2026-11-06');
    const calendar = createCalendar({ holidays: ['2026-11-02', '2026-11-20'] });
    expect(nextDue({ type: 'businessDayOfMonth', n: 5 }, { from: '2026-11-01', calendar })?.due).toBe('2026-11-09');
    expect(nextDue({ type: 'businessDayOfMonth', n: -1 }, { from: '2026-11-01' })?.due).toBe('2026-11-30');
    // Sunday 31 Jan 2027 → Friday 29 Jan
    expect(nextDue({ type: 'businessDayOfMonth', n: -1 }, { from: '2027-01-01' })?.due).toBe('2027-01-29');
  });

  it('repeats weekly', () => {
    const fridays = occurrences({ type: 'weekly', weekday: 5 }, { from: '2026-11-03', to: '2026-11-20' });
    expect(fridays.map((o) => o.due)).toEqual(['2026-11-06', '2026-11-13', '2026-11-20']);
    const calendar = createCalendar({ holidays: ['2026-11-13'] });
    const adjusted = occurrences({ type: 'weekly', weekday: 5, adjust: 'preceding' }, { from: '2026-11-03', count: 2, calendar });
    expect(adjusted).toEqual([
      { nominal: '2026-11-06', due: '2026-11-06' },
      { nominal: '2026-11-13', due: '2026-11-12' },
    ]);
  });

  it('returns nothing for count 0', () => {
    expect(occurrences({ type: 'dayOfMonth', day: 1 }, { from: '2026-11-03', count: 0 })).toEqual([]);
  });

  it('rejects invalid rules and options', () => {
    const from = '2026-11-03';
    expect(() => occurrences({ type: 'dayOfMonth', day: 1 }, { from })).toThrow(RangeError);
    expect(() => occurrences({ type: 'dayOfMonth', day: 0 }, { from, count: 1 })).toThrow(RangeError);
    expect(() => occurrences({ type: 'dayOfMonth', day: 1, months: [] }, { from, count: 1 })).toThrow(RangeError);
    expect(() => occurrences({ type: 'dayOfMonth', day: 1, months: [13] }, { from, count: 1 })).toThrow(RangeError);
    expect(() => occurrences({ type: 'weekdayOfMonth', weekday: 2, nth: 0 }, { from, count: 1 })).toThrow(RangeError);
    expect(() => occurrences({ type: 'businessDayOfMonth', n: 0 }, { from, count: 1 })).toThrow(RangeError);
    expect(() => occurrences({ type: 'weekly', weekday: 8 as never }, { from, count: 1 })).toThrow(RangeError);
    expect(() => occurrences({ type: 'yearly' } as never, { from, count: 1 })).toThrow(RangeError);
    expect(() => occurrences({ type: 'dayOfMonth', day: 1 }, { from: '03/11/2026', count: 1 })).toThrow(RangeError);
  });
});
