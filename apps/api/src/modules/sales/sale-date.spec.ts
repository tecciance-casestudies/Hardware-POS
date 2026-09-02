import { BadRequestException } from '@nestjs/common';
import { dayInTimeZone } from '@hardware-pos/shared';

import { resolveSaleDate, toQuickBooksTxnDate } from './sale-date';

const COLOMBO = 'Asia/Colombo'; // +5:30, no DST
const NEW_YORK = 'America/New_York'; // -5/-4, DST

/** 15 Aug 2026, 14:23 UTC — mid-evening in Colombo, late morning in New York. */
const NOW = new Date('2026-08-15T14:23:00Z');

describe('resolveSaleDate', () => {
  it('falls back to the current instant when no date is given', () => {
    expect(resolveSaleDate(undefined, COLOMBO, NOW)).toEqual(NOW);
  });

  it('stores an instant that reads as the picked day in the shop zone', () => {
    const d = resolveSaleDate('2026-08-01', COLOMBO, NOW);
    expect(dayInTimeZone(d, COLOMBO)).toBe('2026-08-01');
  });

  it('anchors the day in the SHOP zone, not UTC', () => {
    // Midday Colombo on the 1st is 06:30Z that day. The instant is chosen so the
    // shop's calendar day is the one that survives.
    expect(resolveSaleDate('2026-08-01', COLOMBO, NOW).toISOString()).toBe(
      '2026-08-01T06:30:00.000Z',
    );
  });

  it('anchors a shop zone west of UTC the same way', () => {
    const d = resolveSaleDate('2026-08-01', NEW_YORK, NOW);
    expect(dayInTimeZone(d, NEW_YORK)).toBe('2026-08-01');
    expect(d.toISOString()).toBe('2026-08-01T16:00:00.000Z');
  });

  it('uses the offset in force on the picked day, across a DST boundary', () => {
    // US clocks spring forward on 8 Mar 2026: -5 before, -4 after.
    const before = resolveSaleDate('2026-03-07', NEW_YORK, NOW);
    const after = resolveSaleDate('2026-03-09', NEW_YORK, NOW);
    expect(before.toISOString()).toBe('2026-03-07T17:00:00.000Z');
    expect(after.toISOString()).toBe('2026-03-09T16:00:00.000Z');
    expect(dayInTimeZone(before, NEW_YORK)).toBe('2026-03-07');
    expect(dayInTimeZone(after, NEW_YORK)).toBe('2026-03-09');
  });

  it('accepts today as the shop reckons it', () => {
    expect(dayInTimeZone(resolveSaleDate('2026-08-15', COLOMBO, NOW), COLOMBO)).toBe('2026-08-15');
  });

  it('rejects tomorrow', () => {
    expect(() => resolveSaleDate('2026-08-16', COLOMBO, NOW)).toThrow(BadRequestException);
  });

  it('judges "today" by the shop clock, not UTC', () => {
    // 20:30 UTC on 31 Jul is already 1 Aug in Colombo, so the 1st is today there
    // and must be accepted — a UTC-based check would call it the future.
    const lateUtc = new Date('2026-07-31T20:30:00Z');
    expect(dayInTimeZone(lateUtc, 'UTC')).toBe('2026-07-31');
    expect(dayInTimeZone(lateUtc, COLOMBO)).toBe('2026-08-01');
    expect(() => resolveSaleDate('2026-08-01', COLOMBO, lateUtc)).not.toThrow();
  });

  it('still rejects a day that is tomorrow even in the shop zone', () => {
    const lateUtc = new Date('2026-07-31T20:30:00Z');
    expect(() => resolveSaleDate('2026-08-02', COLOMBO, lateUtc)).toThrow(BadRequestException);
  });

  it('accepts a date in a previous year', () => {
    expect(dayInTimeZone(resolveSaleDate('2025-12-31', COLOMBO, NOW), COLOMBO)).toBe('2025-12-31');
  });

  it.each(['not-a-date', '2026-8-1', '2026-02-30', '2026-13-01'])('rejects %s', (v) => {
    expect(() => resolveSaleDate(v, COLOMBO, NOW)).toThrow(BadRequestException);
  });

  it('treats an empty string as "no date given"', () => {
    // The DTO's @Matches already rejects '' at the boundary; the resolver stays
    // permissive so it cannot throw on a field that simply was not filled in.
    expect(resolveSaleDate('', COLOMBO, NOW)).toEqual(NOW);
  });

  it('rejects an absurdly early year from a half-typed date input', () => {
    expect(() => resolveSaleDate('0099-01-01', COLOMBO, NOW)).toThrow(BadRequestException);
    expect(() => resolveSaleDate('1899-01-01', COLOMBO, NOW)).toThrow(BadRequestException);
  });

  it('degrades to the default zone rather than throwing on an unknown one', () => {
    expect(() => resolveSaleDate('2026-08-01', 'Not/AZone', NOW)).not.toThrow();
  });
});

describe('toQuickBooksTxnDate', () => {
  it('reports the shop’s calendar day for the instant', () => {
    expect(toQuickBooksTxnDate(new Date('2026-08-01T06:30:00Z'), COLOMBO)).toBe('2026-08-01');
  });

  it('can differ from the UTC day for the same instant', () => {
    const instant = new Date('2026-07-31T20:30:00Z');
    expect(toQuickBooksTxnDate(instant, 'UTC')).toBe('2026-07-31');
    expect(toQuickBooksTxnDate(instant, COLOMBO)).toBe('2026-08-01');
  });

  it('round-trips a resolved sale date', () => {
    const d = resolveSaleDate('2026-03-07', NEW_YORK, NOW);
    expect(toQuickBooksTxnDate(d, NEW_YORK)).toBe('2026-03-07');
  });

  it('emits a bare calendar date with no time component', () => {
    expect(toQuickBooksTxnDate(NOW, COLOMBO)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
