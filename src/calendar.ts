import { addDays, parseDate, weekdayOf, type DateString, type Weekday } from './date.js';
import {
  MINUTES_PER_DAY,
  compileWorkingHours,
  formatDateTime,
  parseDateTime,
  type DateTimeString,
  type WorkingHours,
} from './hours.js';

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
  /** Working hours on business days, used by the business-hours methods. Defaults to 09:00–17:00. */
  workingHours?: WorkingHours;
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

  /** Whether a moment falls inside working hours on a business day. */
  isWithinBusinessHours(dateTime: DateTimeString): boolean;
  /**
   * Adds (or, with a negative `minutes`, subtracts) working minutes. Time outside working hours
   * doesn't count, so starting at 20:00 counts from the next opening. `0` returns the moment unchanged.
   */
  addBusinessMinutes(dateTime: DateTimeString, minutes: number): DateTimeString;
  /** Like `addBusinessMinutes`, in hours. `1.5` is 90 minutes; the total must be a whole number of minutes. */
  addBusinessHours(dateTime: DateTimeString, hours: number): DateTimeString;
  /** Working minutes from `start` to `end`; negative when `end` is before `start`. */
  businessMinutesBetween(start: DateTimeString, end: DateTimeString): number;
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

  const hoursOf = compileWorkingHours(options.workingHours);
  const rangesOn = (date: DateString) => (isBusinessDay(date) ? hoursOf(weekdayOf(date)) : []);

  function addBusinessMinutes(dateTime: DateTimeString, minutes: number): DateTimeString {
    if (!Number.isInteger(minutes)) throw new RangeError(`Invalid number of minutes ${minutes}: expected an integer`);
    let { date, minute } = parseDateTime(dateTime);
    if (minutes === 0) return dateTime;

    let remaining = Math.abs(minutes);
    // Counts consecutive days without working hours, so a calendar that never opens fails instead of looping.
    for (let idleDays = 0; idleDays <= MAX_SEARCH_DAYS; ) {
      const ranges = rangesOn(date);
      let worked = false;
      if (minutes > 0) {
        for (const [start, end] of ranges) {
          if (end <= minute) continue;
          const from = Math.max(start, minute);
          worked = true;
          if (remaining <= end - from) return formatDateTime(date, from + remaining);
          remaining -= end - from;
        }
        date = addDays(date, 1);
        minute = 0;
      } else {
        for (let i = ranges.length - 1; i >= 0; i--) {
          const [start, end] = ranges[i]!;
          if (start >= minute) continue;
          const to = Math.min(end, minute);
          worked = true;
          if (remaining <= to - start) return formatDateTime(date, to - remaining);
          remaining -= to - start;
        }
        date = addDays(date, -1);
        minute = MINUTES_PER_DAY;
      }
      idleDays = worked ? 0 : idleDays + 1;
    }
    throw new RangeError(`No working hours found within ${MAX_SEARCH_DAYS} days of ${dateTime}`);
  }

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

    isWithinBusinessHours(dateTime) {
      const { date, minute } = parseDateTime(dateTime);
      return rangesOn(date).some(([start, end]) => start <= minute && minute < end);
    },

    addBusinessMinutes,

    addBusinessHours(dateTime, hours) {
      const minutes = hours * 60;
      if (!Number.isInteger(minutes)) {
        throw new RangeError(`Invalid number of hours ${hours}: it must add up to a whole number of minutes`);
      }
      return addBusinessMinutes(dateTime, minutes);
    },

    businessMinutesBetween(start, end) {
      const a = parseDateTime(start);
      const b = parseDateTime(end);
      const [first, last] = start <= end ? [a, b] : [b, a];
      let total = 0;
      for (let date = first.date; date <= last.date; date = addDays(date, 1)) {
        const from = date === first.date ? first.minute : 0;
        const to = date === last.date ? last.minute : MINUTES_PER_DAY;
        for (const [rangeStart, rangeEnd] of rangesOn(date)) {
          total += Math.max(0, Math.min(rangeEnd, to) - Math.max(rangeStart, from));
        }
      }
      return start <= end || total === 0 ? total : -total;
    },
  };
}
