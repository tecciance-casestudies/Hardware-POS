import type { Paginated } from '@hardware-pos/shared';

/** Build the standard paginated payload. */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return { items, total, page, pageSize };
}
