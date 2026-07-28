import type { Block } from "../types";

/** Total scheduled hours for a category across the given ISO dates. */
export function catHoursForDates(
  blocks: Block[],
  catId: string,
  dates: string[]
): number {
  const set = new Set(dates);
  return (
    blocks
      .filter((b) => !b.skipped && b.categoryId === catId && set.has(b.date))
      .reduce((s, b) => s + (b.endMinutes - b.startMinutes), 0) / 60
  );
}
