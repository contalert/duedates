import { createCalendar, type Calendar } from './calendar.js';
import { addDays, parseDate, type DateString } from './date.js';

export interface ReminderOptions {
  /** `'businessDays'` (default) skips weekends and holidays when counting back; `'calendarDays'` counts every day. */
  unit?: 'businessDays' | 'calendarDays';
  /** Defaults to a calendar with Saturday and Sunday as weekend days and no holidays. */
  calendar?: Calendar;
}

/**
 * The dates on which to remind someone of a deadline, sorted and without duplicates.
 * Each offset is how many days before `due` a reminder goes out; `0` is the due date itself.
 */
export function reminderDates(
  due: DateString,
  offsets: readonly number[],
  options: ReminderOptions = {},
): DateString[] {
  parseDate(due);
  const unit = options.unit ?? 'businessDays';
  if (unit !== 'businessDays' && unit !== 'calendarDays') {
    throw new RangeError(`Unknown unit ${JSON.stringify(unit)}: expected "businessDays" or "calendarDays"`);
  }
  const calendar = options.calendar ?? createCalendar();

  const dates = new Set<DateString>();
  for (const offset of offsets) {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new RangeError(`Invalid offset ${offset}: expected a non-negative integer`);
    }
    dates.add(unit === 'businessDays' ? calendar.addBusinessDays(due, -offset) : addDays(due, -offset));
  }
  return [...dates].sort();
}
