/**
 * Pagination arithmetic, shared by every list page.
 *
 * The numbers are computed here rather than in each page so "page 1 of 6",
 * the row range shown to the reader and the `range` window sent to PostgREST
 * can never disagree about which page is being shown.
 *
 * Pages are 1-based everywhere in this app. PostgREST's `range` is 0-based and
 * inclusive on both ends, which is the one conversion worth centralising.
 */

/** Rows per page. Ten keeps a table readable without a scrollbar. */
export const DEFAULT_PAGE_SIZE = 10;

/** How many pages the results are split into. Always at least one. */
export function pageCount(
  total: number | null | undefined,
  pageSize: number
): number {
  if (total == null || !Number.isFinite(total) || total <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/**
 * Keeps a requested page inside the range that actually has rows.
 *
 * Used in two situations that both happen in practice: someone asking for page
 * 4 of a 2-page result, and a list shrinking under the viewer because a record
 * was deleted or a filter narrowed the set.
 */
export function clampPage(page: number, pages: number): number {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.min(Math.floor(page), Math.max(1, pages));
}

/** First row of a page as a 0-based index — the `from` of a PostgREST range. */
export function rangeFrom(page: number, pageSize: number): number {
  return (Math.max(1, Math.floor(page)) - 1) * pageSize;
}

/** Last row of a page as a 0-based index — the `to` of a PostgREST range. */
export function rangeTo(page: number, pageSize: number): number {
  return rangeFrom(page, pageSize) + pageSize - 1;
}

/**
 * The rows currently on screen, as 1-based numbers for display.
 *
 * With a known total the last page stops at the real last row, so "9–10 of 10"
 * rather than "9–18 of 10". With an unknown total (`total` is null, which is
 * what PostgREST reports when it declines to count) it reports what was loaded.
 */
export function visibleRange(
  page: number,
  pageSize: number,
  total: number | null,
  loaded: number
): { from: number; to: number } {
  if (loaded <= 0) {
    return { from: 0, to: 0 };
  }

  const from = rangeFrom(page, pageSize) + 1;
  const to =
    total == null
      ? from + loaded - 1
      : Math.min(total, from + pageSize - 1);

  return { from, to };
}

/** "1 account" / "12 accounts", for the summary line. */
export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1
    ? `${count} ${singular}`
    : `${count} ${plural ?? `${singular}s`}`;
}
