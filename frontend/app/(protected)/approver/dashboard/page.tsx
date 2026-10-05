"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import {
  countProfiles,
  countRequestsByStatus,
  loadDepartmentNames,
  loadProfilesById,
  loadRequestsById,
  type ProfileMap,
} from "@/src/lib/queries";
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
  ArrowRight,
  BadgeCheck,
  CircleX,
  ClipboardCheck,
  FileClock,
  FileText,
  History,
  Inbox,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRoundPlus,
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
  requested_by: string;
};

type ApprovalLog = {
  id: string;
  request_id: string;
  approver_id: string;
  action: string;
  remarks: string | null;
  created_at: string;
};

/** How many pending requests and recent decisions the dashboard shows. */
const PENDING_LIMIT = 5;
const ACTIVITY_LIMIT = 5;

/**
 * Today's date, in the viewer's own timezone.
 *
 * Read in an effect rather than during render: `new Date()` depends on the
 * clock, and a server-rendered string would not match the one the browser
 * produces, which React reports as a hydration mismatch.
 */
function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(
      new Date().toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  return today;
}

export default function ApproverDashboardPage() {
  const { profile } = useProfile();

  const [pendingRequests, setPendingRequests] = useState<PurchaseRequest[]>([]);
  const [recentActivity, setRecentActivity] = useState<ApprovalLog[]>([]);

  const [requestCounts, setRequestCounts] = useState<{
    total: number | null;
    pending: number | null;
    approved: number | null;
    rejected: number | null;
  }>({
    total: null,
    pending: null,
    approved: null,
    rejected: null,
  });

  const [userCounts, setUserCounts] = useState<{
    total: number | null;
    approvers: number | null;
    awaitingDepartment: number | null;
  }>({
    total: null,
    approvers: null,
    awaitingDepartment: null,
  });

  /**
   * Labels for the rows on screen, resolved for the current page of results only
   * — five requests and five decisions, not every request and every user.
   */
  const [requesters, setRequesters] = useState<ProfileMap>(new Map());
  const [departmentNames, setDepartmentNames] = useState<Map<string, string>>(
    new Map()
  );
  const [requestTitles, setRequestTitles] = useState<Map<string, string>>(
    new Map()
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const today = useToday();

  /**
   * The dashboard's five slices of data.
   *
   * Each is bounded (`limit`) or counted (`head`) on purpose. This page used to
   * read every request in the system and derive its cards from that array, which
   * meant the totals were only correct while the table was small enough to
   * download in full.
   */
  const loadDashboard = useCallback(async () => {
    const supabase = createClient();

    try {
      setError("");

      // Every query here is independent: the two lists are bounded by `limit`,
      // the cards are `head` counts, and the lookups below are keyed on ids that
      // are only needed for rendering. So they are issued together and awaited
      // once, rather than as a chain of round trips.
      const [
        pendingResult,
        activityResult,
        totalRequests,
        pendingCount,
        approvedCount,
        rejectedCount,
        totalUsers,
        approverCount,
        awaitingDepartment,
        departmentsResult,
      ] = await Promise.all([
        // The queue: only what still needs a decision.
        supabase
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
            `
          )
          .eq("status", "pending")
          .order("submitted_at", { ascending: true })
          .limit(PENDING_LIMIT),

        // Recent decisions, newest first.
        supabase
          .from("approval_logs")
          .select(
            `
              id,
              request_id,
              approver_id,
              action,
              remarks,
              created_at
            `
          )
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_LIMIT),

        // Cards: counts, no rows.
        countRequestsByStatus(supabase),
        countRequestsByStatus(supabase, "pending"),
        countRequestsByStatus(supabase, "approved"),
        countRequestsByStatus(supabase, "rejected"),
        countProfiles(supabase),
        countProfiles(supabase, "approver"),
        countProfiles(supabase, "unassigned"),

        // Small reference table, so requester departments can be named.
        loadDepartmentNames(supabase),
      ]);

      if (pendingResult.error) {
        console.error("Failed to load pending requests:", pendingResult.error);

        throw new Error(pendingResult.error.message);
      }

      if (activityResult.error) {
        console.error("Failed to load approval activity:", activityResult.error);

        throw new Error(activityResult.error.message);
      }

      const requests = pendingResult.data ?? [];
      const activity = activityResult.data ?? [];

      // The two lookups cover only the ids on screen — ten of them — so they stay
      // small no matter how much history the system accumulates.
      const [profileMap, activityRequests] = await Promise.all([
        loadProfilesById(supabase, [
          ...requests.map((request) => request.requested_by),
          ...activity.map((log) => log.approver_id),
        ]),
        loadRequestsById(
          supabase,
          activity.map((log) => log.request_id)
        ),
      ]);

      // The decision feed shows a request's number and title rather than a bare
      // uuid.
      const titles = new Map<string, string>();

      for (const [id, request] of activityRequests) {
        titles.set(id, `${request.request_number} · ${request.title}`);
      }

      setRequestTitles(titles);
      setPendingRequests(requests);
      setRecentActivity(activity);
      setRequestCounts({
        total: totalRequests,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      });
      setUserCounts({
        total: totalUsers,
        approvers: approverCount,
        awaitingDepartment,
      });
      setDepartmentNames(departmentsResult);
      setRequesters(profileMap);
    } catch (err) {
      console.error("Unexpected dashboard error:", err);

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
    void loadDashboard();
  }, [loadDashboard]);

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
        setRefreshing(true);
        void loadDashboard();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [loadDashboard]);

  function handleRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    void loadDashboard();
  }

  const displayName = profile?.full_name?.trim() || "Approver";

  const summary = useMemo(() => {
    if (requestCounts.pending == null) {
      return "Review and monitor purchase requests.";
    }

    if (requestCounts.pending > 0) {
      return `${requestCounts.pending} ${
        requestCounts.pending === 1 ? "request is" : "requests are"
      } waiting for your decision.`;
    }

    return "Nothing is waiting for a decision right now.";
  }, [requestCounts.pending]);

  function getDepartmentName(requesterId: string) {
    const departmentId = requesters.get(requesterId)?.department_id ?? null;

    if (!departmentId) {
      return "No department";
    }

    return departmentNames.get(departmentId) ?? "Unknown department";
  }

  const quickActions = [
    {
      label: "Review Requests",
      description: "Approve or reject pending purchase requests.",
      href: "/approver/requests",
      icon: ClipboardCheck,
    },
    {
      label: "User Management",
      description: "Create accounts and assign departments.",
      href: "/approver/users",
      icon: UserRoundPlus,
    },
    {
      label: "Approval History",
      description: "Review every decision already recorded.",
      href: "/approver/logs",
      icon: History,
    },
    {
      label: "My Profile",
      description: "Check your own account details.",
      href: "/approver/profile",
      icon: ShieldCheck,
    },
  ];

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
      <PageHeader title={`Welcome back, ${displayName}`} description={summary}>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn(refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </PageHeader>

      {today && (
        <p className="-mt-4 text-xs text-muted-foreground">{today}</p>
      )}

      {/* Request summary */}
      <section aria-label="Request summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Requests"
            value={requestCounts.total}
            icon={FileText}
            tone="primary"
            hint="All submissions"
            href="/approver/requests"
          />

          <StatCard
            label="Pending"
            value={requestCounts.pending}
            icon={FileClock}
            tone="pending"
            hint="Awaiting your decision"
            href="/approver/requests"
          />

          <StatCard
            label="Approved"
            value={requestCounts.approved}
            icon={BadgeCheck}
            tone="approved"
            hint="Cleared for purchase"
          />

          <StatCard
            label="Rejected"
            value={requestCounts.rejected}
            icon={CircleX}
            tone="rejected"
            hint="Sent back to requester"
          />
        </div>
      </section>

      {/* User summary */}
      <section aria-label="User summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Users"
            value={userCounts.total}
            icon={Users}
            tone="default"
            hint="Every account in the directory"
            href="/approver/users"
          />

          <StatCard
            label="Approvers"
            value={userCounts.approvers}
            icon={ShieldCheck}
            tone="primary"
            hint="Can approve requests"
            href="/approver/users"
          />

          <StatCard
            label="Awaiting Department"
            value={userCounts.awaitingDepartment}
            icon={UserRoundPlus}
            tone="pending"
            hint="Not yet assigned"
            href="/approver/users"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Pending requests + recent activity */}
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Pending Requests
                </h2>

                <p className="text-sm text-muted-foreground">
                  Oldest first. {requestCounts.pending ?? 0} in the queue.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/approver/requests" />}
              >
                Review All
                <ArrowRight />
              </Button>
            </div>

            {pendingRequests.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nothing waiting for review"
                description="Every purchase request has had a decision."
              />
            ) : (
              <div
                className={cn(refreshing && "opacity-60")}
                aria-busy={refreshing}
              >
                <Card>
                  <CardContent className="space-y-3 py-4">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {request.title}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {request.request_number} ·{" "}
                            {requesters.get(request.requested_by)?.full_name ??
                              "Unknown requester"}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {getDepartmentName(request.requested_by)} · Submitted{" "}
                            {formatDateTime(request.submitted_at)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={request.priority} />
                            <StatusBadge status={request.status} />
                          </div>

                          <p className="text-sm font-semibold text-foreground tabular-nums">
                            {formatAmount(request.total_amount)}
                          </p>

                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <Link href={`/approver/requests/${request.id}`} />
                            }
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Recent Approval Activity
                </h2>

                <p className="text-sm text-muted-foreground">
                  The latest decisions recorded in the system.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/approver/logs" />}
              >
                View History
                <ArrowRight />
              </Button>
            </div>

            {recentActivity.length === 0 ? (
              <EmptyState
                icon={History}
                title="No approval activity yet"
                description="Decisions will appear here as requests are reviewed."
              />
            ) : (
              <Card>
                <CardContent className="space-y-3 py-4">
                  {recentActivity.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {requestTitles.get(log.request_id) ??
                            "Purchase request"}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {requesters.get(log.approver_id)?.full_name ??
                            "Unknown approver"}
                          {" · "}
                          {formatDateTime(log.created_at)}
                        </p>

                        {log.remarks && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            “{log.remarks}”
                          </p>
                        )}
                      </div>

                      <StatusBadge status={log.action} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        {/* Quick actions */}
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>

              <CardDescription>
                The pages you will use most.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <action.icon className="size-4" />
                  </span>

                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {action.label}
                    </span>

                    <span className="block text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                Queue Snapshot
              </CardTitle>

              <CardDescription>
                Where the current load sits.
              </CardDescription>

              <CardAction>
                <StatusBadge
                  status={
                    (requestCounts.pending ?? 0) > 0 ? "pending" : "approved"
                  }
                />
              </CardAction>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Awaiting decision</span>
                <span className="font-medium text-foreground tabular-nums">
                  {requestCounts.pending ?? "—"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Showing</span>
                <span className="font-medium text-foreground tabular-nums">
                  {pendingRequests.length} oldest
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Decisions recorded</span>
                <span className="font-medium text-foreground tabular-nums">
                  {(requestCounts.approved ?? 0) + (requestCounts.rejected ?? 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
