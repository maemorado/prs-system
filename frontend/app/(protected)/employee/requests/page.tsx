"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { usePagination } from "@/hooks/use-pagination";
import { rangeFrom, rangeTo } from "@/src/lib/pagination";
import { friendlyError } from "@/src/lib/errors";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { FilePlus2, Inbox } from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { PriorityBadge, StatusBadge } from "@/src/components/shared/badges";
import { DataPagination } from "@/src/components/shared/data-pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { formatAmount, formatDate } from "@/src/lib/format";

type PurchaseRequest = {
  id: string;
  request_number: string;
  title: string;
  purpose: string;
  priority: string;
  status: string;
  total_amount: number;
  submitted_at: string;
};

/**
 * The statuses an employee can narrow their own list to. These are the values of
 * the `request_status` enum already in the database.
 */
const STATUS_FILTERS = ["all", "pending", "approved", "rejected"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusFilterLabel(value: StatusFilter) {
  return value === "all"
    ? "All statuses"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { page, pageSize, totalPages, goToPage, resetToFirstPage } =
    usePagination(total);

  /**
   * One page of the signed-in employee's own requests.
   *
   * Rown Level Security already restricts these rows to the owner, and the extra
   * `eq` narrows them to one page window instead of the employee's whole history.
   */
  const loadRequests = useCallback(async () => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You are not authenticated.");
        setLoading(false);

        return;
      }

      let query = supabase
        .from("purchase_requests")
        .select(
          `
            id,
            request_number,
            title,
            purpose,
            priority,
            status,
            total_amount,
            submitted_at
          `,
          { count: "exact" }
        )
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const {
        data,
        error: requestError,
        count,
      } = await query.range(rangeFrom(page, pageSize), rangeTo(page, pageSize));

      if (requestError) {
        console.error("Failed to load requests:", requestError);

        setError(friendlyError(requestError, "Failed to load requests."));

        return;
      }

      setRequests(data ?? []);
      setTotal(count ?? null);
      setError("");
    } catch (err) {
      console.error("Unexpected requests error:", err);

      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests();
  }, [loadRequests]);

  // ==========================================
  // REFETCH WHEN THE PAGE REGAINS FOCUS
  // ==========================================
  useEffect(() => {
    function handleFocus() {
      setRefreshing(true);
      void loadRequests();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadRequests]);

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as StatusFilter);

    // The filtered list starts again at its first page.
    resetToFirstPage();
  }

  function handleRetry() {
    setLoading(true);
    void loadRequests();
  }

  const isFirstLoad = loading && total === null;

  const pendingOnPage = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests]
  );

  if (isFirstLoad) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="My Requests" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title="My Requests"
        description="View and track your purchase requests."
      >
        <Button render={<Link href="/employee/requests/create" />}>
          <FilePlus2 />
          Create Request
        </Button>
      </PageHeader>

      {error && <ErrorState message={error} onRetry={handleRetry} />}

      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          value={statusFilter}
          onChange={(event) => handleStatusFilterChange(event.target.value)}
          aria-label="Filter by status"
          className="w-full sm:w-44"
        >
          {STATUS_FILTERS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {statusFilterLabel(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {pendingOnPage > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {pendingOnPage} awaiting review on this page
          </p>
        )}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No purchase requests yet"
          description={
            statusFilter === "all"
              ? "You don't have any purchase requests yet. Create one to get started."
              : `None of your requests are currently ${statusFilter}.`
          }
          action={
            statusFilter === "all" ? (
              <Button render={<Link href="/employee/requests/create" />}>
                <FilePlus2 />
                Create your first request
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleStatusFilterChange("all")}
              >
                Show all statuses
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          <div className={cn(refreshing && "opacity-60")} aria-busy={refreshing}>
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/employee/requests/${request.id}`}
                className="block transition-colors"
              >
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {request.title}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {request.request_number}
                        </p>

                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {request.purpose}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <PriorityBadge priority={request.priority} />
                        <StatusBadge status={request.status} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">
                        Submitted {formatDate(request.submitted_at)}
                      </span>

                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatAmount(request.total_amount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <DataPagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            loaded={requests.length}
            onPageChange={goToPage}
            itemLabel="request"
            loading={refreshing}
            className="border-t border-border pt-4"
          />
        </div>
      )}
    </div>
  );
}
