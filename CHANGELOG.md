# Changelog

## 0.1.1 — 2026-11-03

- Releases are now built and published from GitHub Actions through npm trusted publishing, with provenance attestations. No library code changes.

## 0.1.0 — 2026-11-03

First release.

- Rules: `dayOfMonth`, `weekdayOfMonth`, `businessDayOfMonth` and `weekly`, with optional `months` filter.
- Business-day adjustments: `following`, `preceding`, `modifiedFollowing`, `modifiedPreceding`.
- Calendars with configurable weekends and holidays (list or function).
- `reminderDates` in business or calendar days.
- Time-zone-safe date helpers, including `today(timeZone)`.
