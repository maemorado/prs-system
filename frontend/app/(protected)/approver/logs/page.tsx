"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { usePagination } from "@/hooks/use-pagination";
import { rangeFrom, rangeTo } from "@/src/lib/pagination";
import {
  countApprovalActions,
  loadProfilesById,
  loadRequestsById,
  type ProfileMap,
  type RequestSummaryMap,
} from "@/src/lib/queries";
import { friendlyError } from "@/src/lib/errors";
import { cn } from "cn";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BadgeCheck,
  CircleX,
  FileClock,
  History,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatCard } from "@/src/components/shared/stat-card";
import { StatusBadge } from "@/src/components/shared/badges";
import { DataPagination } from "@/src/components/shared/data-pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { formatDateTime } from "@/src/lib/format";

type ApprovalLog = {
  id: string;
  request_id: string;
  approver_id: string;
  action: string;
  remarks: string | null;
  created_at: string;
};

/**
 * The decisions recorded in `approval_logs`.
 *
 * These are the values of the `approval_action` enum in the database, so the
 * filter can only ever produce a real result set.
 */
const ACTION_FILTERS = ["all", "approved", "rejected"] as const;

type ActionFilter = (typeof ACTION_FILTERS)[number];

function actionLabel(value: ActionFilter) {
  return value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1);
}

/** Counts for the three summary cards. `null` means "not loaded yet". */
type ActionCounts = {
  total: number | null;
  approved: number | null;
  rejected: number | null;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [counts, setCounts] = useState<ActionCounts>({
    total: null,
    approved: null,
    rejected: null,
  });

  /**
   * Labels for the rows on screen only.
   *
   * Resolved for the current page rather than for the whole history. This page
   * used to read every log, then every request, then every profile, and filter
   * the result in the browser — three unbounded queries for a list that only
   * shows ten rows at a time.
   */
  const [requests, setRequests] = useState<RequestSummaryMap>(new Map());
  const [approvers, setApprovers] = useState<ProfileMap>(new Map());

  const { page, pageSize, totalPages, goToPage, resetToFirstPage } =
    usePagination(total);

  /**
   * Head counts for the cards, which describe the whole history rather than the
   * filtered page. Loaded once: the totals only move when a decision is made,
   * which also navigates away from this page.
   */
  const loadCounts = useCallback(async () => {
    const supabase = createClient();

    const [totalCount, approvedCount, rejectedCount] = await Promise.all([
      countApprovalActions(supabase),
      countApprovalActions(supabase, "approved"),
      countApprovalActions(supabase, "rejected"),
    ]);

    setCounts({
      total: totalCount,
      approved: approvedCount,
      rejected: rejectedCount,
    });
  }, []);

  /**
   * One page of approval history, filtered by the database.
   *
   * The action filter is a server-side `eq`, so it narrows the history before
   * the page window applies, and `count: "exact"` is what lets the footer say
   * "1–10 of 13" instead of guessing from the rows that happened to arrive.
   */
  const loadLogs = useCallback(async () => {
    const supabase = createClient();

    try {
      let query = supabase
        .from("approval_logs")
        .select(
          `
            id,
            request_id,
            approver_id,
            action,
            remarks,
            created_at
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error: logsError, count } = await query.range(
        rangeFrom(page, pageSize),
        rangeTo(page, pageSize)
      );

      if (logsError) {
        console.error("Load logs error:", logsError);

        setError(friendlyError(logsError, "Failed to load approval history."));

        return;
      }

      const rows = data ?? [];

      setLogs(rows);
      setTotal(count ?? null);
      setError("");

      // The two lookups only cover this page's ids, so they stay small no
      // matter how long the history gets.
      const [requestMap, profileMap] = await Promise.all([
        loadRequestsById(
          supabase,
          rows.map((log) => log.request_id)
        ),
        loadProfilesById(
          supabase,
          rows.map((log) => log.approver_id)
        ),
      ]);

      setRequests(requestMap);
      setApprovers(profileMap);
    } catch (err) {
      console.error("Unexpected logs error:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load approval history."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, actionFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();
  }, [loadLogs]);

  function handleFilterChange(value: ActionFilter) {
    setActionFilter(value);

    // A narrowed history starts again at its first page, otherwise a page
    // number carried over from the unfiltered view can land past the last page.
    resetToFirstPage();
  }

  function handleRefresh() {
    setRefreshing(true);
    void loadLogs();
    void loadCounts();
  }

  function handleRetry() {
    setLoading(true);
    void loadLogs();
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Approval History" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title="Approval History"
        description="Every approval and rejection recorded in the system."
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn(refreshing && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      {error && <ErrorState message={error} onRetry={handleRetry} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Actions"
          value={counts.total}
          icon={FileClock}
          tone="primary"
        />

        <StatCard
          label="Approved"
          value={counts.approved}
          icon={BadgeCheck}
          tone="approved"
        />

        <StatCard
          label="Rejected"
          value={counts.rejected}
          icon={CircleX}
          tone="rejected"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            Decision log
          </CardTitle>

          <CardDescription>
            Filter by decision. Each row links back to the request it was made
            on.
          </CardDescription>

          <CardAction>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {ACTION_FILTERS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={
                    actionFilter === value ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => handleFilterChange(value)}
                  disabled={refreshing}
                >
                  {actionLabel(value)}
                </Button>
              ))}
            </div>
          </CardAction>
        </CardHeader>

        <CardContent
          className="space-y-4 border-t border-border pt-4"
          aria-busy={refreshing}
        >
          {logs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No approval history found"
              description={
                actionFilter === "all"
                  ? "No request has been approved or rejected yet."
                  : `No request has been ${actionFilter} yet.`
              }
              action={
                actionFilter === "all" ? undefined : (
                  <Button
                    variant="outline"
                    onClick={() => handleFilterChange("all")}
                  >
                    Show all decisions
                  </Button>
                )
              }
            />
          ) : (
            <div className={cn(refreshing && "opacity-60")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Processed By</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {logs.map((log) => {
                    const request = requests.get(log.request_id);

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {request ? (
                            <Link
                              href={`/approver/requests/${request.id}`}
                              className="hover:underline"
                            >
                              {request.request_number}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              Request unavailable
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <p className="max-w-[220px] truncate font-medium text-foreground">
                            {request?.title ?? "Unknown request"}
                          </p>
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={log.action} />
                        </TableCell>

                        <TableCell className="whitespace-normal">
                          <p className="font-medium text-foreground">
                            {approvers.get(log.approver_id)?.full_name ??
                              "Unknown user"}
                          </p>
                        </TableCell>

                        <TableCell className="whitespace-normal">
                          <p className="max-w-[260px] text-sm text-muted-foreground">
                            {log.remarks || "No remarks"}
                          </p>
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(log.created_at)}
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
            loaded={logs.length}
            onPageChange={goToPage}
            itemLabel="decision"
            loading={refreshing}
            className="border-t border-border pt-4"
          />
        </CardContent>
      </Card>
    </div>
  );
}
