"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pluralize, visibleRange } from "@/src/lib/pagination";
import { cn } from "cn";

type DataPaginationProps = {
  /** 1-based page currently shown. */
  page: number;
  pageSize: number;
  /**
   * Total rows matching the current filters, or null when the database did not
   * report a count. The row range is still shown either way; only "of N" is
   * left off when the total is unknown.
   */
  total: number | null;
  /** Rows actually on the current page. */
  loaded: number;
  onPageChange: (page: number) => void;
  /** Total pages, or null when unknown. */
  totalPages: number | null;
  /** Called when Next is pressed but the end of the list is not known. */
  onNextWhenUnknown?: () => void;
  /** Singular noun for one row, used in the summary ("3 accounts"). */
  itemLabel: string;
  /** A request is in flight: the range is replaced by a loading state. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * The one pagination control in the app.
 *
 * Every list that can grow uses this, so paging behaves identically everywhere:
 * Previous is disabled on the first page, Next on the last, and both are
 * disabled while a request is in flight so a double click cannot skip a page.
 *
 * The row range is a live region, because on a server-paginated list the count
 * of what is on screen changes without the page navigating.
 */

/**
 * Page numbers to render, with `"ellipsis"` for a gap. Kept to a small,
 * predictable window around the current page so the control never grows with
 * the number of pages.
 */
function pageItems(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    items.push("ellipsis");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < total - 1) {
    items.push("ellipsis");
  }

  items.push(total);

  return items;
}

export function DataPagination({
  page,
  pageSize,
  total,
  loaded,
  onPageChange,
  totalPages,
  onNextWhenUnknown,
  itemLabel,
  loading = false,
  disabled = false,
  className,
}: DataPaginationProps) {
  const { from, to } = visibleRange(page, pageSize, total, loaded);

  const isFirstPage = page <= 1;
  // With an unknown total there is no last page to recognise, so Next stays
  // available and the caller stops paging when a short page comes back.
  const isLastPage = totalPages == null ? false : page >= totalPages;

  const controlsDisabled = disabled || loading;

  function handleNext() {
    if (isLastPage) {
      return;
    }

    if (totalPages == null) {
      onNextWhenUnknown?.();

      return;
    }

    onPageChange(page + 1);
  }

  if (loaded === 0 && !loading) {
    // Nothing to page through. The list renders its own empty state, and an
    // inert "Previous / Next" pair under it would only be noise.
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p
        aria-live="polite"
        aria-busy={loading}
        className="text-xs text-muted-foreground"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" />
            Loading {itemLabel}...
          </span>
        ) : total == null ? (
          <>Showing {pluralize(loaded, itemLabel)}</>
        ) : (
          <>
            Showing <span className="tabular-nums">{from}</span>–
            <span className="tabular-nums">{to}</span> of{" "}
            <span className="tabular-nums">{total}</span>{" "}
            {total === 1 ? itemLabel : `${itemLabel}s`}
          </>
        )}
      </p>

      <div className="flex items-center gap-1.5">
        <p className="mr-auto text-xs text-muted-foreground tabular-nums">
          {totalPages == null
            ? `Page ${page}`
            : `Page ${page} of ${totalPages}`}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={controlsDisabled || isFirstPage}
          aria-label="Go to previous page"
        >
          <ChevronLeft />
          <span className="hidden sm:inline">Previous</span>
          <span className="sr-only sm:hidden">Previous</span>
        </Button>

        {totalPages != null && totalPages > 1 && (
          <nav aria-label="Pagination" className="hidden items-center gap-1 md:flex">
            {pageItems(page, totalPages).map((item) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${page}`}
                  aria-hidden="true"
                  className="px-1 text-xs text-muted-foreground"
                >
                  &hellip;
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === page ? "default" : "outline"}
                  size="icon-sm"
                  className="tabular-nums"
                  onClick={() => onPageChange(item)}
                  disabled={controlsDisabled}
                  aria-label={`Go to page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                >
                  {item}
                </Button>
              )
            )}
          </nav>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={controlsDisabled || isLastPage}
          aria-label="Go to next page"
        >
          <span className="hidden sm:inline">Next</span>
          <span className="sr-only sm:hidden">Next</span>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
