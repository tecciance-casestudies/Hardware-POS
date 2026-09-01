import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TIME_ZONE,
  dayInTimeZone,
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatTimeInTimeZone,
  isValidTimeZone,
  parseDay,
  safeTimeZone,
  todayInTimeZone,
  zonedTimeToUtc,
} from '@hardware-pos/shared';

/**
 * `packages/shared` has no runner of its own, so its timezone maths is covered
 * here — apps/web is a real consumer and already runs vitest.
 *
 * The instant below is the one that motivates the whole feature: 20:30 UTC on
 * 31 July is already 1 August in Colombo. Which day a sale "happened on" depends
 * entirely on who is looking.
 */
const ACROSS_MIDNIGHT = new Date('2026-07-31T20:30:00Z');

describe('dayInTimeZone', () => {
  it('reports the local day, which can differ from the UTC day', () => {
    expect(dayInTimeZone(ACROSS_MIDNIGHT, 'Asia/Colombo')).toBe('2026-08-01');
    expect(dayInTimeZone(ACROSS_MIDNIGHT, 'UTC')).toBe('2026-07-31');
    expect(dayInTimeZone(ACROSS_MIDNIGHT, 'America/New_York')).toBe('2026-07-31');
  });

  it('handles a zone far west of UTC', () => {
    expect(dayInTimeZone(new Date('2026-08-01T05:00:00Z'), 'America/Los_Angeles')).toBe(
      '2026-07-31',
    );
  });
});

describe('zonedTimeToUtc', () => {
  it('resolves a wall-clock time in a zone to the right instant', () => {
    expect(zonedTimeToUtc(2026, 8, 1, 12, 0, 0, 'Asia/Colombo').toISOString()).toBe(
      '2026-08-01T06:30:00.000Z',
    );
  });

  it('round-trips: the instant reads back as the same day in that zone', () => {
    const utc = zonedTimeToUtc(2026, 8, 1, 0, 0, 0, 'America/Los_Angeles');
    expect(dayInTimeZone(utc, 'America/Los_Angeles')).toBe('2026-08-01');
  });

  it('uses the offset in force on the day, not a fixed one (DST)', () => {
    // US clocks spring forward on 2026-03-08, so noon is -5 before and -4 after.
    expect(zonedTimeToUtc(2026, 3, 7, 12, 0, 0, 'America/New_York').toISOString()).toBe(
      '2026-03-07T17:00:00.000Z',
    );
    expect(zonedTimeToUtc(2026, 3, 9, 12, 0, 0, 'America/New_York').toISOString()).toBe(
      '2026-03-09T16:00:00.000Z',
    );
  });

  it('keeps the intended day across an autumn transition', () => {
    const d = zonedTimeToUtc(2026, 11, 1, 12, 0, 0, 'America/New_York');
    expect(dayInTimeZone(d, 'America/New_York')).toBe('2026-11-01');
  });
});

describe('formatting', () => {
  it('renders the same instant as different days in different zones', () => {
    expect(formatDateInTimeZone(ACROSS_MIDNIGHT, 'Asia/Colombo')).toBe('01 Aug 2026');
    expect(formatDateInTimeZone(ACROSS_MIDNIGHT, 'America/New_York')).toBe('31 Jul 2026');
  });

  it('renders date and time together', () => {
    expect(formatDateTimeInTimeZone(ACROSS_MIDNIGHT, 'Asia/Colombo')).toBe('01 Aug 2026, 02:00');
  });

  it('renders time alone', () => {
    expect(formatTimeInTimeZone(ACROSS_MIDNIGHT, 'Asia/Colombo')).toBe('02:00');
  });

  it('falls back to the default zone rather than throwing on a bad one', () => {
    expect(formatDateInTimeZone(ACROSS_MIDNIGHT, 'Not/AZone')).toBe(
      formatDateInTimeZone(ACROSS_MIDNIGHT, DEFAULT_TIME_ZONE),
    );
  });
});

describe('zone validation', () => {
  it.each(['Asia/Colombo', 'UTC', 'America/New_York', 'Europe/London'])('accepts %s', (tz) => {
    expect(isValidTimeZone(tz)).toBe(true);
  });

  it.each(['', 'Not/AZone', 'nonsense'])('rejects %s', (tz) => {
    expect(isValidTimeZone(tz)).toBe(false);
  });

  it('safeTimeZone substitutes the default for anything unusable', () => {
    expect(safeTimeZone('Not/AZone')).toBe(DEFAULT_TIME_ZONE);
    expect(safeTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(safeTimeZone('Europe/London')).toBe('Europe/London');
  });
});

describe('parseDay', () => {
  it('accepts a real calendar day', () => {
    expect(parseDay('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '0099-01-01', '2026-8-1', 'nonsense', ''])(
    'rejects %s',
    (v) => {
      expect(parseDay(v)).toBeNull();
    },
  );
});

describe('todayInTimeZone', () => {
  it('is the injected instant read in the given zone', () => {
    expect(todayInTimeZone('Asia/Colombo', ACROSS_MIDNIGHT)).toBe('2026-08-01');
    expect(todayInTimeZone('UTC', ACROSS_MIDNIGHT)).toBe('2026-07-31');
  });
});
