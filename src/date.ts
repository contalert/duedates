/** A calendar date in ISO 8601 format, `YYYY-MM-DD`. No time of day, no time zone. */
export type DateString = string;

/** ISO 8601 weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value: number) => String(value).padStart(2, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Number of days in a month (`month` is 1–12). */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Splits a date string into its parts. Throws `RangeError` unless it is a real date in `YYYY-MM-DD` format. */
export function parseDate(date: DateString): { year: number; month: number; day: number } {
  const match = typeof date === 'string' ? ISO_DATE.exec(date) : null;
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return { year, month, day };
    }
  }
  throw new RangeError(`Invalid date ${JSON.stringify(date)}: expected a real date in YYYY-MM-DD format`);
}

/** `true` when `value` is a real calendar date in `YYYY-MM-DD` format. */
export function isValidDate(value: unknown): value is DateString {
  try {
    parseDate(value as DateString);
    return true;
  } catch {
    return false;
  }
}

export function makeDate(year: number, month: number, day: number): DateString {
  const date = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  parseDate(date);
  return date;
}

/** Days since 1970-01-01. Plain integer math, so no time zone or DST can shift a date. */
function toDayNumber(date: DateString): number {
  const { year, month, day } = parseDate(date);
  const time = new Date(0);
  time.setUTCFullYear(year, month - 1, day);
  return Math.round(time.getTime() / MS_PER_DAY);
}

function fromDayNumber(dayNumber: number): DateString {
  const time = new Date(dayNumber * MS_PER_DAY);
  return makeDate(time.getUTCFullYear(), time.getUTCMonth() + 1, time.getUTCDate());
}

/** Adds (or, with a negative `days`, subtracts) calendar days. */
export function addDays(date: DateString, days: number): DateString {
  if (!Number.isInteger(days)) throw new RangeError(`Invalid number of days ${days}: expected an integer`);
  return fromDayNumber(toDayNumber(date) + days);
}

/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: DateString): Weekday {
  // 1970-01-01 was a Thursday (ISO weekday 4).
  return ((((toDayNumber(date) + 3) % 7) + 7) % 7) + 1 as Weekday;
}

/**
 * Today's date in a time zone, e.g. `today('America/New_York')`.
 * Defaults to the time zone of the running environment.
 */
export function today(timeZone?: string, now: Date = new Date()): DateString {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
