import { addDays, parseDate, type DateString, type Weekday } from './date.js';

/** A time of day on a 24-hour clock, `HH:mm`. `24:00` is allowed as the end of a range. */
export type TimeString = string;

/**
 * A wall-clock moment, `YYYY-MM-DDTHH:mm`, with no time zone.
 * Read it in the business's own time zone — see `now(timeZone)`.
 */
export type DateTimeString = string;

/** Working time from `start` (inclusive) to `end` (exclusive), e.g. `['09:00', '17:00']`. */
export type TimeRange = readonly [start: TimeString, end: TimeString];

/**
 * The same ranges on every business day, e.g. `[['09:00', '12:00'], ['13:00', '18:00']]`,
 * or ranges per ISO weekday, e.g. `{ 1: [...], 5: [...] }` (weekdays left out have no working hours).
 */
export type WorkingHours = readonly TimeRange[] | Partial<Record<Weekday, readonly TimeRange[]>>;

/** Minute ranges `[start, end)` within a day. */
export type MinuteRanges = readonly (readonly [number, number])[];

export const MINUTES_PER_DAY = 1440;

const TIME = /^(\d{2}):(\d{2})$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

const pad2 = (value: number) => String(value).padStart(2, '0');

function parseTime(time: TimeString, allowEndOfDay: boolean): number {
  const match = typeof time === 'string' ? TIME.exec(time) : null;
  if (match) {
    const minutes = Number(match[2]);
    const minute = Number(match[1]) * 60 + minutes;
    if (minutes < 60 && (minute < MINUTES_PER_DAY || (allowEndOfDay && minute === MINUTES_PER_DAY))) return minute;
  }
  const range = allowEndOfDay ? '00:00 to 24:00' : '00:00 to 23:59';
  throw new RangeError(`Invalid time ${JSON.stringify(time)}: expected HH:mm, ${range}`);
}

/** Splits a date-time string into its date and minute of the day. Throws `RangeError` on invalid input. */
export function parseDateTime(dateTime: DateTimeString): { date: DateString; minute: number } {
  const match = typeof dateTime === 'string' ? DATE_TIME.exec(dateTime) : null;
  if (!match) throw new RangeError(`Invalid date-time ${JSON.stringify(dateTime)}: expected YYYY-MM-DDTHH:mm`);
  const date = match[1] as DateString;
  parseDate(date);
  return { date, minute: parseTime(match[2] as TimeString, false) };
}

/** Formats a date and minute of the day; minute 1440 (24:00) becomes 00:00 of the next day. */
export function formatDateTime(date: DateString, minute: number): DateTimeString {
  if (minute === MINUTES_PER_DAY) return formatDateTime(addDays(date, 1), 0);
  return `${date}T${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`;
}

/** Validates working hours and returns the minute ranges of each weekday. Defaults to 09:00–17:00. */
export function compileWorkingHours(hours: WorkingHours = [['09:00', '17:00']]): (weekday: Weekday) => MinuteRanges {
  const compile = (ranges: readonly TimeRange[], label: string): MinuteRanges => {
    if (!Array.isArray(ranges)) throw new RangeError(`Invalid working hours${label}: expected a list of [start, end] ranges`);
    const result = ranges.map(([start, end]) => [parseTime(start, false), parseTime(end, true)] as const);
    result.forEach(([start, end], i) => {
      if (end <= start) {
        throw new RangeError(`Invalid working hours${label}: ${ranges[i]?.[0]}–${ranges[i]?.[1]} must end after it starts`);
      }
      const previous = result[i - 1];
      if (previous && start < previous[1]) {
        throw new RangeError(`Invalid working hours${label}: ranges must be in order and must not overlap`);
      }
    });
    return result;
  };

  if (Array.isArray(hours)) {
    const ranges = compile(hours as readonly TimeRange[], '');
    return () => ranges;
  }

  const byWeekday = new Map<number, MinuteRanges>();
  for (const [key, ranges] of Object.entries(hours as Partial<Record<Weekday, readonly TimeRange[]>>)) {
    const weekday = Number(key);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      throw new RangeError(`Invalid weekday ${key} in working hours: expected 1 (Monday) to 7 (Sunday)`);
    }
    byWeekday.set(weekday, compile(ranges ?? [], ` for weekday ${weekday}`));
  }
  return (weekday) => byWeekday.get(weekday) ?? [];
}

/**
 * The current wall-clock moment in a time zone, e.g. `now('America/New_York')` → `'2026-11-05T09:30'`.
 * Defaults to the time zone of the running environment.
 */
export function now(timeZone?: string, at: Date = new Date()): DateTimeString {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
