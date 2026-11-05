# duedates

**Recurring deadlines that respect weekends, holidays and month boundaries.**

`duedates` answers the questions every billing, payroll, compliance and reminder system eventually has to answer:

- *"Invoices are due on the 20th — but what if the 20th is a Sunday?"*
- *"When is the 5th business day of next month?"*
- *"Which dates should we send reminders on, 7, 3 and 1 business days before?"*
- *"A ticket opened Friday at 3 pm must be answered within 4 business hours — by when?"*

[![npm](https://img.shields.io/npm/v/@contalert/duedates)](https://www.npmjs.com/package/@contalert/duedates)
[![CI](https://github.com/contalert/duedates/actions/workflows/ci.yml/badge.svg)](https://github.com/contalert/duedates/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license MIT](https://img.shields.io/badge/license-MIT-blue)

## Why

- **Time-zone safe.** Dates are plain `YYYY-MM-DD` strings and all math is integer day arithmetic. No `Date` object can shift your deadline by a day because of a time zone or daylight saving time.
- **Real-world conventions.** Following, preceding, *modified following* and *modified preceding* — the same business-day conventions used in finance.
- **Any country.** Choose your weekend (e.g. Friday–Saturday) and bring your own holidays: a list of dates or a function.
- **Zero dependencies**, fully typed, ESM, tiny.

## Install

```sh
npm install @contalert/duedates
```

Requires Node.js 20 or later (or any modern browser or runtime).

## Quick start

```ts
import { createCalendar, occurrences, reminderDates } from '@contalert/duedates';

const calendar = createCalendar({
  holidays: ['2026-12-25', '2027-01-01'],
});

// "Due on the 20th of every month; if that's not a business day, the next one."
const deadlines = occurrences(
  { type: 'dayOfMonth', day: 20, adjust: 'following' },
  { from: '2026-11-03', count: 3, calendar },
);
// [
//   { nominal: '2026-11-20', due: '2026-11-20' },
//   { nominal: '2026-12-20', due: '2026-12-21' },  ← Sunday moved to Monday
//   { nominal: '2027-01-20', due: '2027-01-20' },
// ]

reminderDates('2026-12-21', [7, 3, 1], { calendar });
// ['2026-12-10', '2026-12-16', '2026-12-18']
```

## Rules

Every rule produces a **nominal** date (what the rule says) and a **due** date (after adjusting for non-business days).

| Rule | Example | Meaning |
|---|---|---|
| `dayOfMonth` | `{ type: 'dayOfMonth', day: 20 }` | The 20th of every month. Days past the end of a month use its last day (31 → 28/29 Feb). |
| | `{ type: 'dayOfMonth', day: 'last' }` | The last day of every month. |
| `weekdayOfMonth` | `{ type: 'weekdayOfMonth', weekday: 2, nth: 2 }` | The second Tuesday of every month. |
| | `{ type: 'weekdayOfMonth', weekday: 5, nth: -1 }` | The last Friday of every month. |
| `businessDayOfMonth` | `{ type: 'businessDayOfMonth', n: 5 }` | The 5th business day of every month. |
| | `{ type: 'businessDayOfMonth', n: -1 }` | The last business day of every month. |
| `weekly` | `{ type: 'weekly', weekday: 1 }` | Every Monday. |

Weekdays follow ISO 8601: `1` = Monday … `7` = Sunday.

Monthly rules accept `months` to run only in some months:

```ts
// Quarterly: last day of March, June, September and December
{ type: 'dayOfMonth', day: 'last', months: [3, 6, 9, 12] }

// Yearly: April 15th
{ type: 'dayOfMonth', day: 15, months: [4] }
```

### Adjustments

All rules except `businessDayOfMonth` (which is always a business day) accept `adjust`:

| `adjust` | When the date is not a business day… |
|---|---|
| `'none'` *(default)* | keep it. |
| `'following'` | move to the next business day. |
| `'preceding'` | move to the previous business day. |
| `'modifiedFollowing'` | move forward, unless that crosses into the next month — then move back. |
| `'modifiedPreceding'` | move back, unless that crosses into the previous month — then move forward. |

## API

### `occurrences(rule, { from, to?, count?, calendar? })`

Returns `{ nominal, due }[]` for every occurrence whose due date is on or after `from`, stopping at `to` (inclusive), after `count` results, or both. At least one of `to` and `count` is required.

### `nextDue(rule, { from, calendar? })`

The first occurrence due on or after `from`.

### `createCalendar({ weekend?, holidays?, workingHours? })`

- `weekend` — weekdays that are never business days. Default `[6, 7]` (Saturday, Sunday).
- `holidays` — an iterable of `YYYY-MM-DD` strings, or a function `(date) => boolean`.
- `workingHours` — working hours on business days, for the [business-hours methods](#business-hours-slas). Default 09:00–17:00.

The calendar has:

| Method | |
|---|---|
| `isBusinessDay(date)` / `isWeekend(date)` / `isHoliday(date)` | Checks a date. |
| `adjust(date, adjustment)` | Applies one of the adjustments above. |
| `addBusinessDays(date, n)` | Moves `n` business days forward (or back, if negative). |
| `businessDaysBetween(start, end)` | Business days after `start` up to and including `end`. |

### `reminderDates(due, offsets, { unit?, calendar? })`

The dates to send reminders on, `offsets` days before `due`, sorted and de-duplicated. `unit` is `'businessDays'` (default) or `'calendarDays'`.

### Business hours (SLAs)

For deadlines measured in hours — support tickets, SLAs, approval windows — give the calendar working hours. Moments are wall-clock `YYYY-MM-DDTHH:mm` strings in the business's own time zone.

```ts
import { createCalendar, now } from '@contalert/duedates';

const support = createCalendar({
  holidays: ['2026-12-25'],
  workingHours: [['09:00', '12:00'], ['13:00', '18:00']], // lunch break excluded
});

// Ticket opened Friday at 15:00, SLA of 4 business hours
support.addBusinessHours('2026-11-06T15:00', 4);
// '2026-11-09T10:00' — Friday 15:00–18:00, then Monday 09:00–10:00

support.businessMinutesBetween('2026-11-06T15:00', '2026-11-09T11:00'); // 300
support.isWithinBusinessHours(now('America/New_York'));
```

| Method | |
|---|---|
| `addBusinessHours(dateTime, hours)` | Moves forward (or back, if negative) by working hours. `1.5` is 90 minutes. |
| `addBusinessMinutes(dateTime, minutes)` | The same, in minutes. |
| `businessMinutesBetween(start, end)` | Working minutes from `start` to `end`. |
| `isWithinBusinessHours(dateTime)` | Whether a moment is inside working hours on a business day. |

- `workingHours` defaults to `[['09:00', '17:00']]`. Ranges include their start and exclude their end; `'24:00'` is allowed as an end.
- Use an object for hours that differ by weekday: `{ 1: [['09:00', '18:00']], 5: [['09:00', '13:00']] }`. Weekdays left out have no working hours.
- Time outside working hours doesn't count: a ticket opened at 20:00 starts its clock at the next opening. A deadline that fills a day exactly ends at closing time (17:00), not at the next opening.
- `now(timeZone?)` gives the current wall-clock moment, e.g. `now('Europe/London')`.

### Date helpers

`addDays(date, n)`, `weekdayOf(date)`, `daysInMonth(year, month)`, `isLeapYear(year)`, `isValidDate(value)` and `today(timeZone?)` — for example `today('America/New_York')`.

Invalid input (a date that doesn't exist, an unknown rule, …) throws a `RangeError` with a clear message.

## Holidays for your country

`duedates` doesn't ship holiday data — holiday rules change, and you know which ones apply to you. Pass a list, or plug in any holiday library. For example, with [`date-holidays`](https://www.npmjs.com/package/date-holidays):

```ts
import Holidays from 'date-holidays';
import { createCalendar } from '@contalert/duedates';

const us = new Holidays('US');

const calendar = createCalendar({
  holidays: (date) => {
    const found = us.isHoliday(new Date(`${date}T12:00:00`));
    return Array.isArray(found) && found.some((holiday) => holiday.type === 'public');
  },
});
```

## Releases

Every release is built from this repository by GitHub Actions and published through npm trusted publishing, with [provenance](https://docs.npmjs.com/generating-provenance-statements) — so you can verify that the package on npm came from this source code. A maintainer approves each release with two-factor authentication before it goes live.

## Contributing

Issues and pull requests are welcome. Run `npm test` and `npm run typecheck` before opening a pull request. Please report security issues privately — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © ContAlert Sistemas Ltda
