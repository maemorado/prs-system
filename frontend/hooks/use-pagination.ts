"use client";

import * as React from "react";
import { DEFAULT_PAGE_SIZE, clampPage, pageCount } from "@/src/lib/pagination";

type Pagination = {
  /** The page to fetch and render. Never past the last page. */
  page: number;
  pageSize: number;
  /** Total pages, or null when the total row count is unknown. */
  totalPages: number | null;
  /** Page `n` exists. False only when the total is unknown. */
  hasPrevious: boolean;
  hasNext: boolean;
  goToPage: (page: number) => void;
  /** Called when a filter changes, so a narrowed result set starts at page 1. */
  resetToFirstPage: () => void;
};

/**
 * Page state for a server-paginated list.
 *
 * The page number is stored, but what callers receive is always clamped to the
 * number of pages that actually have rows. That is what makes the two awkward
 * cases behave without any extra bookkeeping: an out-of-range page left over
 * from a filter that has since narrowed the list is corrected on the next
 * fetch, and the same happens when a row is deleted while the viewer is on the
 * final page. No effect, and no chance of rendering an empty table over a
 * list that still has rows in it.
 *
 * `total` is the row count reported by the database for the *current* filters,
 * or null when the count is unavailable. With a null total the hook still tracks
 * the page number and Next stays enabled, which is the honest behaviour for a
 * list whose length is unknown.
 */
export function usePagination(
  total: number | null,
  pageSize: number = DEFAULT_PAGE_SIZE
): Pagination {
  const [requestedPage, setRequestedPage] = React.useState(1);

  const pages = pageCount(total, pageSize);

  const page = clampPage(requestedPage, pages);

  const goToPage = React.useCallback(
    (next: number) => {
      setRequestedPage(clampPage(next, pageCount(total, pageSize)));
    },
    [total, pageSize]
  );

  const resetToFirstPage = React.useCallback(() => {
    setRequestedPage(1);
  }, []);

  return {
    page,
    pageSize,
    totalPages: total == null ? null : pages,
    hasPrevious: page > 1,
    // Without a total there is no last page to compare against, so the caller
    // decides whether to stop (it disables the control through `disabled`).
    hasNext: total == null ? true : page < pages,
    goToPage,
    resetToFirstPage,
  };
}
