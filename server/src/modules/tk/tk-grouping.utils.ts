import type { TkSyncItem } from './tk.types';

/**
 * Groups items by their local date key, oldest day first, with items inside each day in time
 * order. Pure: the caller computes each item's `dateKey` with `toDateKeyInTimeZone` before
 * calling this (see server/src/common/utils/timezone.utils.ts), so the grouping itself never
 * touches a timezone.
 */
export function groupItemsByDateKey(items: readonly TkSyncItem[]): Map<string, TkSyncItem[]> {
  const byDate = new Map<string, TkSyncItem[]>();
  for (const item of items) {
    const bucket = byDate.get(item.dateKey);
    if (bucket) bucket.push(item);
    else byDate.set(item.dateKey, [item]);
  }
  for (const bucket of byDate.values()) {
    bucket.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
  return new Map([...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
