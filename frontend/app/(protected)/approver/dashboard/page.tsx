"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BadgeCheck,
  CircleX,
  FileClock,
  FileText,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatCard } from "@/src/components/shared/stat-card";
import { PriorityBadge, StatusBadge } from "@/src/components/shared/badges";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
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
};

export default function ApproverDashboardPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    const supabase = createClient();

    try {
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Authentication error:", authError);
        setError(authError.message);
        return;
      }

      if (!user) {
        setError("You are not authenticated.");
        return;
      }

      /*
       * IMPORTANT:
       * Do NOT filter by status here.
       *
       * The dashboard needs to receive the current status
       * of every purchase request so that:
       *
       * pending  -> Pending
       * approved -> Approved
       * rejected -> Rejected
       *
       * can be displayed after a refetch.
       */
      const {
        data,
        error: requestError,
      } = await supabase
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
          `
        )
        .order("submitted_at", {
          ascending: true,
        });

      if (requestError) {
        console.error(
          "Failed to load purchase requests:",
          requestError
        );

        setError(requestError.message);
        return;
      }

      setRequests(data ?? []);
    } catch (err) {
      console.error(
        "Unexpected dashboard error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load purchase requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /*
   * Initial load
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequests();
  }, [loadRequests]);

  /*
   * Refetch whenever the browser tab becomes visible again.
   *
   * This allows the dashboard to pick up:
   *
   * pending -> approved
   * pending -> rejected
   */
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        loadRequests();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener(
      "focus",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "focus",
        handleVisibility
      );
    };
  }, [loadRequests]);

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    await loadRequests();
  }

  const pendingCount = requests.filter(
    (request) =>
      request.status.toLowerCase() === "pending"
  ).length;

  const approvedCount = requests.filter(
    (request) =>
      request.status.toLowerCase() === "approved"
  ).length;

  const rejectedCount = requests.filter(
    (request) =>
      request.status.toLowerCase() === "rejected"
  ).length;

  /*
   * Loading
   */
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        <PageHeader title="Approver Dashboard" />
        <ListSkeleton />
      </div>
    );
  }

  /*
   * Error
   */
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        <PageHeader title="Approver Dashboard" />

        <ErrorState
          message={error}
          onRetry={handleRefresh}
          retryLabel={refreshing ? "Retrying..." : "Try Again"}
          retryDisabled={refreshing}
        />
      </div>
    );
  }

  /*
   * Dashboard
   */
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* Header */}
      <PageHeader
        title="Approver Dashboard"
        description="Review and monitor purchase requests."
      >
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={cn(refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing..." : "Refresh Requests"}
        </Button>
      </PageHeader>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Requests"
          value={requests.length}
          icon={FileText}
          tone="primary"
        />

        <StatCard
          label="Pending"
          value={pendingCount}
          icon={FileClock}
          tone="pending"
        />

        <StatCard
          label="Approved"
          value={approvedCount}
          icon={BadgeCheck}
          tone="approved"
        />

        <StatCard
          label="Rejected"
          value={rejectedCount}
          icon={CircleX}
          tone="rejected"
        />
      </div>

      {/* All Requests */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Purchase Requests
          </h2>

          <span className="text-xs text-muted-foreground">
            {requests.length}{" "}
            {requests.length === 1 ? "request" : "requests"}
          </span>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No Purchase Requests"
            description="There are currently no purchase requests."
          />
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/approver/requests/${request.id}`}
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
                        Submitted {formatDateTime(request.submitted_at)}
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
        )}
      </section>
    </div>
  );
}