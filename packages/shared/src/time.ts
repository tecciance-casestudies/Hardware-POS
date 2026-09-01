/**
 * Timezone handling, shared by the browser and the API.
 *
 * The rule this package encodes:
 *
 *  - Every instant is STORED and TRANSPORTED in UTC. A `DateTime` column holds a
 *    UTC instant, and every datetime crosses the wire as an ISO-8601 string.
 *    Nothing is ever persisted as a bare calendar day.
 *  - Instants are converted to a timezone only at the moment they are SHOWN.
 *    Which timezone depends on what is being shown:
 *      · on screen  → the viewer's own zone, from `browserTimeZone()`
 *      · on a document (invoice, receipt, PDF report) → the shop's zone, from
 *        settings, so one invoice reads the same date for everyone who opens it
 *
 * Everything here is pure and dependency-free; the zone maths uses `Intl`, which
 * both Node (full ICU since v13) and every supported browser provide.
 */

/** Fallback when no shop timezone has been configured. */
export const DEFAULT_TIME_ZONE = 'Asia/Colombo';

/**
 * The viewer's own IANA zone (e.g. `Europe/London`). Browser-only — on the
 * server this reports the host's zone, which is not the viewer's, so never call
 * it during server rendering.
 */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** True when `tz` is a zone this runtime actually knows. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** `tz` if usable, otherwise the default — so a bad setting degrades, never throws. */
export function safeTimeZone(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading an observer in `tz` sees at instant `date`. */
function partsInTimeZone(date: Date, tz: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    // `hourCycle: 'h23'` rather than `hour12: false`, which some ICU builds
    // render as 24:00 for midnight.
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Belt and braces against an ICU build that still reports 24 for midnight.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** `tz`'s offset from UTC at instant `date`, in milliseconds (east of UTC is positive). */
function offsetMs(date: Date, tz: string): number {
  const p = partsInTimeZone(date, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Match the second, so the difference is purely the zone offset.
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The UTC instant at which the clock in `tz` reads the given wall-clock time.
 *
 * Resolved in two passes: the first guess uses the offset in force at the naive
 * instant, the second re-checks it at the corrected instant. That second pass is
 * what makes the result right across a DST boundary, where the offset before and
 * after the transition differ.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string,
): Date {
  const zone = safeTimeZone(tz);
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = new Date(naive - offsetMs(new Date(naive), zone));
  const second2 = new Date(naive - offsetMs(first, zone));
  return second2;
}

/** The calendar day (`YYYY-MM-DD`) that instant `date` falls on in `tz`. */
export function dayInTimeZone(date: Date, tz: string): string {
  const p = partsInTimeZone(date, safeTimeZone(tz));
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(
    p.day,
  ).padStart(2, '0')}`;
}

/** Today's calendar day in `tz`. */
export function todayInTimeZone(tz: string, now: Date = new Date()): string {
  return dayInTimeZone(now, tz);
}

/** Parse `YYYY-MM-DD`, returning its numeric parts, or null when malformed. */
export function parseDay(ymd: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject a day that does not exist (2026-02-30) rather than letting it roll.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

/** `01 Aug 2026` — the instant's calendar day as read in `tz`. */
export function formatDateInTimeZone(date: Date, tz: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTS, timeZone: safeTimeZone(tz) }).format(date);
}

/** `01 Aug 2026, 14:23` — the instant as read in `tz`. */
export function formatDateTimeInTimeZone(date: Date, tz: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    ...DATE_OPTS,
    ...TIME_OPTS,
    timeZone: safeTimeZone(tz),
  }).format(date);
}

/** `14:23` — the instant's time of day as read in `tz`. */
export function formatTimeInTimeZone(date: Date, tz: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { ...TIME_OPTS, timeZone: safeTimeZone(tz) }).format(date);
}
