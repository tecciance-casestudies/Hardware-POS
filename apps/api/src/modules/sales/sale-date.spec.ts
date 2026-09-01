import { BadRequestException } from '@nestjs/common';

import { resolveSaleDate, toQuickBooksTxnDate } from './sale-date';

/** 14:23:45.500 local on 15 Aug 2026 — a fixed "now" for every case below. */
const NOW = new Date(2026, 7, 15, 14, 23, 45, 500);

describe('resolveSaleDate', () => {
  it('falls back to now when no date is given', () => {
    expect(resolveSaleDate(undefined, NOW)).toEqual(NOW);
  });

  it('keeps the picked calendar day in local time', () => {
    const d = resolveSaleDate('2026-08-01', NOW);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August
    expect(d.getDate()).toBe(1);
  });

  it('carries the current time of day onto a backdated sale', () => {
    const d = resolveSaleDate('2026-08-01', NOW);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([14, 23, 45]);
  });

  it('accepts today', () => {
    const d = resolveSaleDate('2026-08-15', NOW);
    expect(d.getDate()).toBe(15);
    expect(d.getTime()).toBe(NOW.getTime());
  });

  it('rejects tomorrow', () => {
    expect(() => resolveSaleDate('2026-08-16', NOW)).toThrow(BadRequestException);
  });

  it('rejects a far-future date', () => {
    expect(() => resolveSaleDate('2027-01-01', NOW)).toThrow(BadRequestException);
  });

  it('accepts a date in a previous year', () => {
    expect(resolveSaleDate('2025-12-31', NOW).getFullYear()).toBe(2025);
  });

  it('rejects an unparseable value', () => {
    expect(() => resolveSaleDate('not-a-date', NOW)).toThrow(BadRequestException);
  });

  it('rejects a day that does not exist rather than rolling it forward', () => {
    // `new Date(2026, 1, 30)` would silently become 2 March.
    expect(() => resolveSaleDate('2026-02-30', NOW)).toThrow(BadRequestException);
  });

  it('does not interpret the date as UTC', () => {
    // The bug this guards: `new Date('2026-08-01')` is UTC midnight, which is
    // 31 Jul for any server behind UTC. The local build must stay on the 1st.
    expect(resolveSaleDate('2026-08-01', NOW).getDate()).toBe(1);
  });

  it('rejects an absurdly early year from a half-typed date input', () => {
    expect(() => resolveSaleDate('0002-01-01', NOW)).toThrow(BadRequestException);
  });

  it('rejects a two-digit year rather than mapping it into the 1900s', () => {
    // `new Date(0099, ...)` is 1999, which would otherwise pass the 1990 floor.
    expect(() => resolveSaleDate('0099-01-01', NOW)).toThrow(BadRequestException);
  });

  it('rejects a later instant on the same day from a full ISO value', () => {
    const laterToday = new Date(2026, 7, 15, 23, 59).toISOString();
    expect(() => resolveSaleDate(laterToday, NOW)).toThrow(BadRequestException);
  });

  it('accepts a full ISO instant in the past unchanged', () => {
    const iso = new Date(2026, 6, 4, 9, 30).toISOString();
    expect(resolveSaleDate(iso, NOW).getTime()).toBe(new Date(iso).getTime());
  });
});

describe('toQuickBooksTxnDate', () => {
  it('formats as a zero-padded local calendar date', () => {
    expect(toQuickBooksTxnDate(new Date(2026, 7, 1, 14, 23))).toBe('2026-08-01');
  });

  it('pads single-digit months and days', () => {
    expect(toQuickBooksTxnDate(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
  });

  it('reports the local day even late in the evening', () => {
    // toISOString().slice(0,10) would roll this to the next day east of UTC.
    expect(toQuickBooksTxnDate(new Date(2026, 7, 1, 23, 30))).toBe('2026-08-01');
  });

  it('round-trips a resolved sale date', () => {
    expect(toQuickBooksTxnDate(resolveSaleDate('2026-03-07', NOW))).toBe('2026-03-07');
  });
});
