import { addDays, parseDate, weekdayOf, type DateString, type Weekday } from './date.js';

/**
 * How a date that falls on a non-business day is moved.
 *
 * - `none` — keep the date as is.
 * - `following` — move forward to the next business day.
 * - `preceding` — move back to the previous business day.
 * - `modifiedFollowing` — move forward, unless that changes the month; then move back.
 * - `modifiedPreceding` — move back, unless that changes the month; then move forward.
 */
export type Adjustment = 'none' | 'following' | 'preceding' | 'modifiedFollowing' | 'modifiedPreceding';

export const ADJUSTMENTS: readonly Adjustment[] = [
  'none',
  'following',
  'preceding',
  'modifiedFollowing',
  'modifiedPreceding',
];

export interface CalendarOptions {
  /** Weekdays that are never business days (1 = Monday … 7 = Sunday). Defaults to `[6, 7]`. */
  weekend?: readonly Weekday[];
  /** Holidays, as a list of dates or a function that returns `true` for a holiday. */
  holidays?: Iterable<DateString> | ((date: DateString) => boolean);
}

export interface Calendar {
  isWeekend(date: DateString): boolean;
  isHoliday(date: DateString): boolean;
  /** Neither a weekend day nor a holiday. */
  isBusinessDay(date: DateString): boolean;
  /** Moves a date that is not a business day, following the given convention. */
  adjust(date: DateString, adjustment: Adjustment): DateString;
  /** Adds (or, with a negative `days`, subtracts) business days. `0` returns the date unchanged. */
  addBusinessDays(date: DateString, days: number): DateString;
  /** Business days after `start` up to and including `end`; negative when `end` is before `start`. */
  businessDaysBetween(start: DateString, end: DateString): number;
}

/** A calendar with no business day within this many days is treated as broken. */
const MAX_SEARCH_DAYS = 3660;

export function createCalendar(options: CalendarOptions = {}): Calendar {
  const weekend = new Set<number>(options.weekend ?? [6, 7]);
  for (const day of weekend) {
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw new RangeError(`Invalid weekday ${day}: expected 1 (Monday) to 7 (Sunday)`);
    }
  }
  if (weekend.size === 7) throw new RangeError('A calendar needs at least one weekday that is not a weekend day');

  const { holidays } = options;
  let holidayCheck: (date: DateString) => boolean;
  if (typeof holidays === 'function') {
    holidayCheck = holidays;
  } else {
    const dates = new Set<DateString>();
    for (const date of holidays ?? []) {
      parseDate(date);
      dates.add(date);
    }
    holidayCheck = (date) => dates.has(date);
  }

  const isWeekend = (date: DateString) => weekend.has(weekdayOf(date));
  const isHoliday = (date: DateString) => {
    parseDate(date);
    return holidayCheck(date);
  };
  const isBusinessDay = (date: DateString) => !isWeekend(date) && !isHoliday(date);

  /** The date itself if it is a business day, otherwise the nearest one in `direction`. */
  function seek(date: DateString, direction: 1 | -1): DateString {
    let current = date;
    for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
      if (isBusinessDay(current)) return current;
      current = addDays(current, direction);
    }
    throw new RangeError(`No business day found within ${MAX_SEARCH_DAYS} days of ${date}`);
  }

  const sameMonth = (a: DateString, b: DateString) => a.slice(0, 7) === b.slice(0, 7);

  return {
    isWeekend,
    isHoliday,
    isBusinessDay,

    adjust(date, adjustment) {
      switch (adjustment) {
        case 'none':
          parseDate(date);
          return date;
        case 'following':
          return seek(date, 1);
        case 'preceding':
          return seek(date, -1);
        case 'modifiedFollowing': {
          const next = seek(date, 1);
          return sameMonth(next, date) ? next : seek(date, -1);
        }
        case 'modifiedPreceding': {
          const previous = seek(date, -1);
          return sameMonth(previous, date) ? previous : seek(date, 1);
        }
        default:
          throw new RangeError(`Unknown adjustment ${JSON.stringify(adjustment)}: expected one of ${ADJUSTMENTS.join(', ')}`);
      }
    },

    addBusinessDays(date, days) {
      if (!Number.isInteger(days)) throw new RangeError(`Invalid number of days ${days}: expected an integer`);
      parseDate(date);
      const direction = days < 0 ? -1 : 1;
      let current = date;
      for (let remaining = Math.abs(days); remaining > 0; remaining--) {
        current = seek(addDays(current, direction), direction);
      }
      return current;
    },

    businessDaysBetween(start, end) {
      parseDate(start);
      parseDate(end);
      const [first, last] = start <= end ? [start, end] : [end, start];
      let count = 0;
      for (let date = addDays(first, 1); date <= last; date = addDays(date, 1)) {
        if (isBusinessDay(date)) count++;
      }
      return start <= end || count === 0 ? count : -count;
    },
  };
}
