import { ADJUSTMENTS, createCalendar, type Adjustment, type Calendar } from './calendar.js';
import { addDays, daysInMonth, makeDate, parseDate, weekdayOf, type DateString, type Weekday } from './date.js';

interface MonthlyRuleBase {
  /** Only these months (1–12). Use `[3, 6, 9, 12]` for quarterly or `[4]` for yearly deadlines. */
  months?: readonly number[];
}

/** A fixed day of the month, e.g. "every 20th". Days past the end of a month use its last day. */
export interface DayOfMonthRule extends MonthlyRuleBase {
  type: 'dayOfMonth';
  day: number | 'last';
  adjust?: Adjustment;
}

/** The nth weekday of the month, e.g. "second Tuesday" (`nth: 2`) or "last Friday" (`nth: -1`). */
export interface WeekdayOfMonthRule extends MonthlyRuleBase {
  type: 'weekdayOfMonth';
  weekday: Weekday;
  /** 1 to 5 counts from the start of the month, -1 to -5 from the end. Months without it are skipped. */
  nth: number;
  adjust?: Adjustment;
}

/** The nth business day of the month, e.g. "5th business day" (`n: 5`) or "last business day" (`n: -1`). */
export interface BusinessDayOfMonthRule extends MonthlyRuleBase {
  type: 'businessDayOfMonth';
  /** Positive counts from the start of the month, negative from the end. */
  n: number;
}

/** Every week on the same weekday. */
export interface WeeklyRule {
  type: 'weekly';
  weekday: Weekday;
  adjust?: Adjustment;
}

export type Rule = DayOfMonthRule | WeekdayOfMonthRule | BusinessDayOfMonthRule | WeeklyRule;

export interface Occurrence {
  /** The date the rule names, before any business-day adjustment. */
  nominal: DateString;
  /** The date the deadline actually falls on. */
  due: DateString;
}

export interface OccurrenceOptions {
  /** First date to include (compared against `due`). */
  from: DateString;
  /** Last date to include (compared against `due`). */
  to?: DateString;
  /** Maximum number of occurrences to return. */
  count?: number;
  /** Defaults to a calendar with Saturday and Sunday as weekend days and no holidays. */
  calendar?: Calendar;
}

/** Generation stops after this many months (or weeks) so a rule that rarely matches cannot loop forever. */
const MAX_MONTHS = 1200;
const MAX_WEEKS = 5220;

/** Due dates of a rule from `from` on, until `to` or `count` is reached (at least one of them is required). */
export function occurrences(rule: Rule, options: OccurrenceOptions): Occurrence[] {
  const { from, to, count } = options;
  parseDate(from);
  if (to !== undefined) parseDate(to);
  if (to === undefined && count === undefined) throw new RangeError('Pass `to`, `count`, or both');
  if (count !== undefined && (!Number.isInteger(count) || count < 0)) {
    throw new RangeError(`Invalid count ${count}: expected a non-negative integer`);
  }
  validateRule(rule);

  const calendar = options.calendar ?? createCalendar();
  const result: Occurrence[] = [];
  if (count === 0) return result;

  const nominals = rule.type === 'weekly' ? weeklyNominals(rule, from) : monthlyNominals(rule, from, calendar);
  for (const nominal of nominals) {
    const due = rule.type === 'businessDayOfMonth' ? nominal : calendar.adjust(nominal, rule.adjust ?? 'none');
    // Adjustments never reorder dates, so the first due date past `to` ends the search.
    if (to !== undefined && due > to) break;
    if (due < from) continue;
    result.push({ nominal, due });
    if (result.length === count) break;
  }
  return result;
}

/** The first occurrence due on or after `from`, or `undefined` if there is none within 100 years. */
export function nextDue(rule: Rule, options: { from: DateString; calendar?: Calendar }): Occurrence | undefined {
  return occurrences(rule, { ...options, count: 1 })[0];
}

function* monthlyNominals(rule: Exclude<Rule, WeeklyRule>, from: DateString, calendar: Calendar) {
  const months = rule.months ? new Set(rule.months) : undefined;
  // Start a month early: a date late last month may be adjusted forward into range.
  let { year, month } = parseDate(from);
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  for (let i = 0; i < MAX_MONTHS; i++) {
    if (!months || months.has(month)) {
      const nominal = nominalInMonth(rule, year, month, calendar);
      if (nominal) yield nominal;
    }
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
}

function* weeklyNominals(rule: WeeklyRule, from: DateString) {
  // Start a week early: a date late last week may be adjusted forward into range.
  const daysSinceWeekday = (weekdayOf(from) - rule.weekday + 7) % 7;
  let nominal = addDays(from, -daysSinceWeekday - 7);
  for (let i = 0; i < MAX_WEEKS; i++) {
    yield nominal;
    nominal = addDays(nominal, 7);
  }
}

function nominalInMonth(
  rule: Exclude<Rule, WeeklyRule>,
  year: number,
  month: number,
  calendar: Calendar,
): DateString | undefined {
  const lastDay = daysInMonth(year, month);

  switch (rule.type) {
    case 'dayOfMonth':
      return makeDate(year, month, rule.day === 'last' ? lastDay : Math.min(rule.day, lastDay));

    case 'weekdayOfMonth': {
      let day: number;
      if (rule.nth > 0) {
        const firstWeekday = weekdayOf(makeDate(year, month, 1));
        day = 1 + ((rule.weekday - firstWeekday + 7) % 7) + 7 * (rule.nth - 1);
      } else {
        const lastWeekday = weekdayOf(makeDate(year, month, lastDay));
        day = lastDay - ((lastWeekday - rule.weekday + 7) % 7) + 7 * (rule.nth + 1);
      }
      return day >= 1 && day <= lastDay ? makeDate(year, month, day) : undefined;
    }

    case 'businessDayOfMonth': {
      const step = rule.n > 0 ? 1 : -1;
      let seen = 0;
      for (let day = step > 0 ? 1 : lastDay; day >= 1 && day <= lastDay; day += step) {
        const date = makeDate(year, month, day);
        if (calendar.isBusinessDay(date) && ++seen === Math.abs(rule.n)) return date;
      }
      return undefined;
    }
  }
}

function validateRule(rule: Rule): void {
  const fail = (message: string): never => {
    throw new RangeError(`Invalid ${rule?.type ?? 'rule'} rule: ${message}`);
  };
  const isWeekday = (value: unknown) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 7;

  if ('months' in rule && rule.months !== undefined) {
    if (rule.months.length === 0) fail('`months` must not be empty');
    for (const month of rule.months) {
      if (!Number.isInteger(month) || month < 1 || month > 12) fail(`month ${month} is not 1–12`);
    }
  }
  if ('adjust' in rule && rule.adjust !== undefined && !ADJUSTMENTS.includes(rule.adjust)) {
    fail(`unknown adjustment ${JSON.stringify(rule.adjust)}`);
  }

  switch (rule?.type) {
    case 'dayOfMonth':
      if (rule.day !== 'last' && !(Number.isInteger(rule.day) && rule.day >= 1 && rule.day <= 31)) {
        fail('`day` must be 1–31 or "last"');
      }
      return;
    case 'weekdayOfMonth':
      if (!isWeekday(rule.weekday)) fail('`weekday` must be 1 (Monday) to 7 (Sunday)');
      if (!Number.isInteger(rule.nth) || rule.nth === 0 || rule.nth < -5 || rule.nth > 5) {
        fail('`nth` must be 1 to 5 or -1 to -5');
      }
      return;
    case 'businessDayOfMonth':
      if (!Number.isInteger(rule.n) || rule.n === 0 || Math.abs(rule.n) > 23) {
        fail('`n` must be 1 to 23 or -1 to -23');
      }
      return;
    case 'weekly':
      if (!isWeekday(rule.weekday)) fail('`weekday` must be 1 (Monday) to 7 (Sunday)');
      return;
    default:
      throw new RangeError(`Unknown rule type ${JSON.stringify((rule as { type?: unknown })?.type)}`);
  }
}
