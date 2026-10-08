"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { usePagination } from "@/hooks/use-pagination";
import { rangeFrom, rangeTo } from "@/src/lib/pagination";
import { loadDepartmentNames, loadProfilesById } from "@/src/lib/queries";
import { friendlyError } from "@/src/lib/errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ClipboardCheck, Inbox } from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/src/components/shared/page-header";
import { DataPagination } from "@/src/components/shared/data-pagination";
import { PriorityBadge, StatusBadge } from "@/src/components/shared/badges";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/src/components/shared/state";
import { formatAmount, formatDateTime } from "@/src/lib/format";

type PurchaseRequest = {
  id: string;
  request_number: string;
  title: string;
  purpose: string;
  priority: string;
  status: string;
  total_amount: number;
  submitted_at: string;
  requested_by: string;
};

/**
 * The statuses a reviewer can narrow the list to.
 *
 * These are the values of the `request_status` enum already in the database, so
 * the filter can only ever produce a real result set.
 */
const STATUS_FILTERS = ["all", "pending", "approved", "rejected"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusFilterLabel(value: StatusFilter) {
  return value === "all"
    ? "All statuses"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  /**
   * Names for the rows on screen only.
   *
   * Looked up by id per page rather than by loading every request and every
   * profile, which is what this page used to do: the cost of a row's label now
   * follows the page size instead of the size of the table.
   */
  const [profiles, setProfiles] = useState<Map<string, { full_name: string; department_id: string | null }>>(new Map());
  const [departmentNames, setDepartmentNames] = useState<Map<string, string>>(new Map());

  const { page, pageSize, totalPages, goToPage, resetToFirstPage } =
    usePagination(total);

  const loadDepartments = useCallback(async () => {
    setDepartmentNames(await loadDepartmentNames(createClient()));
  }, []);

  /**
   * One page of requests, filtered by the database.
   *
   * The status filter is a server-side `eq`, so it narrows the result set before
   * the page window is applied. Paging therefore walks through the filtered
   * requests only, and `count: "exact"` is what makes "1–10 of 34" honest.
   */
  const loadRequests = useCallback(async () => {
    const supabase = createClient();

    try {
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
            submitted_at,
            requested_by
          `,
          { count: "exact" }
        )
        .order("submitted_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const {
        data,
        error: requestError,
        count,
      } = await query.range(rangeFrom(page, pageSize), rangeTo(page, pageSize));

      if (requestError) {
        console.error("Admin requests error:", requestError);

        setError(friendlyError(requestError, "Failed to load requests."));

        return;
      }

      const rows = data ?? [];

      setRequests(rows);
      setTotal(count ?? null);
      setProfiles(
        await loadProfilesById(
          supabase,
          rows.map((request) => request.requested_by)
        )
      );
      setError("");
    } catch (err) {
      console.error("Unexpected requests error:", err);

      setError(
        friendlyError(err, "Failed to load requests.")
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests();
  }, [loadRequests]);

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as StatusFilter);

    // The filtered list starts again at its first page, otherwise a page number
    // carried over from an unfiltered view can land past the last page.
    resetToFirstPage();
  }

  function handleRetry() {
    setLoading(true);
    void loadRequests();
  }

  function getRequesterName(requesterId: string) {
    return profiles.get(requesterId)?.full_name ?? "Unknown requester";
  }

  function getDepartmentName(departmentId: string | null) {
    if (!departmentId) {
      return "Not assigned";
    }

    return departmentNames.get(departmentId) ?? "Unknown department";
  }

  const isFirstLoad = loading && total === null;

  const pendingOnPage = useMemo(
    () =>
      requests.filter((request) => request.status === "pending").length,
    [requests]
  );

  if (isFirstLoad) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Purchase Requests" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title="Purchase Requests"
        description="View and manage all purchase requests."
      >
        <Button
          variant="ghost"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Dashboard
        </Button>
      </PageHeader>

      {error && (
        <ErrorState
          message={error}
          onRetry={handleRetry}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-muted-foreground" />
            All requests
          </CardTitle>

          <CardDescription>
            Filter by status, then open a request to approve or reject it.
          </CardDescription>

          <CardAction>
            {pendingOnPage > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {pendingOnPage} awaiting review on this page
              </span>
            )}
          </CardAction>
        </CardHeader>

        <CardContent
          className="space-y-4 border-t border-border pt-4"
          aria-busy={refreshing}
        >
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <NativeSelect
              value={statusFilter}
              onChange={(event) =>
                handleStatusFilterChange(event.target.value)
              }
              aria-label="Filter by status"
              className="w-full sm:w-44"
            >
              {STATUS_FILTERS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {statusFilterLabel(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <p className="text-xs text-muted-foreground">
              Approving or rejecting a request moves it out of the pending
              filter, because its status changes.
            </p>
          </div>

          {requests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={
                statusFilter === "all"
                  ? "No Purchase Requests"
                  : `No ${statusFilterLabel(statusFilter).toLowerCase()} requests`
              }
              description={
                statusFilter === "all"
                  ? "There are currently no purchase requests in the system."
                  : "No request currently has that status."
              }
              action={
                statusFilter === "all" ? undefined : (
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
            <div className={cn(refreshing && "opacity-60")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request No.</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {requests.map((request) => {
                    const departmentId =
                      profiles.get(request.requested_by)?.department_id ??
                      null;

                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium text-foreground">
                          {request.request_number}
                        </TableCell>

                        <TableCell>
                          <span className="block max-w-[220px] truncate">
                            {request.title}
                          </span>

                          <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
                            {request.purpose}
                          </span>
                        </TableCell>

                        <TableCell className="whitespace-normal">
                          {getRequesterName(request.requested_by)}
                        </TableCell>

                        <TableCell className="text-muted-foreground whitespace-normal">
                          {getDepartmentName(departmentId)}
                        </TableCell>

                        <TableCell>
                          <PriorityBadge priority={request.priority} />
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>

                        <TableCell className="text-right font-medium tabular-nums text-foreground">
                          {formatAmount(request.total_amount)}
                        </TableCell>

                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(request.submitted_at)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <Link href={`/approver/requests/${request.id}`} />
                            }
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

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
        </CardContent>
      </Card>
    </div>
  );
}
