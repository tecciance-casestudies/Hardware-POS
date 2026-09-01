import { BadRequestException } from '@nestjs/common';

/**
 * Resolution of the user-chosen invoice date for a POS sale ("backdating").
 *
 * The POS sends a plain calendar date (`YYYY-MM-DD`) — the day the sale actually
 * happened. Two rules keep that day intact everywhere it is later rendered:
 *
 *  - It is interpreted in the SERVER's local timezone, never as UTC. Invoices are
 *    formatted with `toLocaleDateString` (server-local), so `new Date('2026-08-01')`
 *    — which JS parses as UTC midnight — would print 31 Jul on any server west of
 *    Greenwich. Building the date locally makes the printed day match the picked day
 *    whatever the deployment timezone.
 *  - It carries the current time of day rather than midnight, so a backdated
 *    invoice reads like a real one ("01 Aug 2026, 14:23") and a sale dated today is
 *    indistinguishable from one with no date at all.
 *
 * Forward dating is rejected: a sale may be dated today or earlier, never later.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Lower bound — the same calendar floor the sales-history filter uses
 * (`MIN_FILTER_DATE` in `query-sales.dto.ts`). Built locally so it is compared
 * in the same frame `picked` is constructed in. Date inputs emit absurd years
 * mid-typing; without this a stray `0002-01-01` reaches Postgres.
 */
const MIN_SALE_DATE = new Date(1990, 0, 1);

/** Local midnight of the day `d` falls on — the comparable "calendar day" value. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Turn the DTO's optional `saleDate` into the timestamp to store as `completedAt`.
 *
 * @param input `YYYY-MM-DD`, or a full ISO string, or undefined for "now"
 * @param now   injected for testability; defaults to the current instant
 * @throws BadRequestException on an unparseable or future date
 */
export function resolveSaleDate(input: string | undefined, now: Date = new Date()): Date {
  if (!input) return now;

  const match = DATE_ONLY.exec(input);
  // A full ISO timestamp already pins an instant, so take it as given; only a
  // date-only value needs a time of day attached.
  const picked = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      )
    : new Date(input);

  if (Number.isNaN(picked.getTime())) {
    throw new BadRequestException('saleDate must be a valid date (YYYY-MM-DD)');
  }
  if (match) {
    // The multi-arg Date constructor is forgiving in two ways that must not pass
    // silently: it rolls a day that does not exist into the next month
    // (2026-02-30 → 2 Mar), and it maps a two-digit year into the 1900s
    // (0099 → 1999). Reject anything it did not reproduce exactly.
    if (
      picked.getFullYear() !== Number(match[1]) ||
      picked.getMonth() !== Number(match[2]) - 1 ||
      picked.getDate() !== Number(match[3])
    ) {
      throw new BadRequestException('saleDate must be a valid date (YYYY-MM-DD)');
    }
    // Whole-day comparison: any time earlier today is fine, tomorrow is not.
    if (startOfLocalDay(picked) > startOfLocalDay(now)) {
      throw new BadRequestException('A sale cannot be dated in the future');
    }
  } else if (picked > now) {
    // A full ISO value pins an instant, so it is checked to the instant — a
    // day-granular check would let "later today" through.
    throw new BadRequestException('A sale cannot be dated in the future');
  }
  if (picked < MIN_SALE_DATE) {
    throw new BadRequestException('saleDate is out of range');
  }
  return picked;
}

/**
 * QuickBooks `TxnDate` wire format — a bare calendar date, no time or offset.
 * Derived in server-local time so the day filed in QuickBooks is the day picked
 * in the POS.
 */
export function toQuickBooksTxnDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
