"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { friendlyError } from "@/src/lib/errors";
import { useProfile } from "@/src/components/shared/profile-provider";
import { countProfiles, countRequestsByStatus } from "@/src/lib/queries";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BadgeCheck,
  CircleX,
  ClipboardCheck,
  FileClock,
  FileText,
  History,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRoundPlus,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatCard } from "@/src/components/shared/stat-card";
import { ErrorState, StatsSkeleton } from "@/src/components/shared/state";

/**
 * The Approver Dashboard is informational.
 *
 * It reports totals and points at the pages where work happens; the
 * approve/reject decision itself belongs on the request review page
 * (`/approver/requests/[id]`) and the recorded decisions live on the
 * Approval History page (`/approver/logs`). This page deliberately holds no
 * queue, no processing snapshot and no decision actions.
 */

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const today = useToday();

  /**
   * The dashboard's only data: seven counts.
   *
   * Each card is a `head` query, so PostgREST counts server-side and returns a
   * number without transferring rows — the totals therefore describe every
   * request and every account, not whatever happened to be loaded.
   */
  const loadDashboard = useCallback(async () => {
    const supabase = createClient();

    try {
      setError("");

      const [
        totalRequests,
        pendingCount,
        approvedCount,
        rejectedCount,
        totalUsers,
        approverCount,
        awaitingDepartment,
      ] = await Promise.all([
        countRequestsByStatus(supabase),
        countRequestsByStatus(supabase, "pending"),
        countRequestsByStatus(supabase, "approved"),
        countRequestsByStatus(supabase, "rejected"),
        countProfiles(supabase),
        countProfiles(supabase, "approver"),
        countProfiles(supabase, "unassigned"),
      ]);

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
    } catch (err) {
      console.error("Unexpected dashboard error:", err);

      setError(
        friendlyError(err, "Failed to load the dashboard summary.")
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
   * Refetch whenever the browser tab becomes visible again, so a decision made
   * elsewhere shows up without a manual refresh.
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
      } waiting for a decision.`;
    }

    return "Nothing is waiting for a decision right now.";
  }, [requestCounts.pending]);

  const quickActions = [
    {
      label: "Purchase Requests",
      description: "Browse every purchase request in the system.",
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
        <StatsSkeleton />
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
   * Dashboard — totals and navigation only.
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
            hint="Awaiting a decision"
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

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>

            <CardDescription>
              The pages you will use most.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-2 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
      </section>
    </div>
  );
}
