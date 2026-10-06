"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  ArrowRight,
  BadgeCheck,
  CircleX,
  FileClock,
  FilePlus2,
  Inbox,
  Receipt,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatCard } from "@/src/components/shared/stat-card";
import { PriorityBadge, StatusBadge } from "@/src/components/shared/badges";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { formatAmount } from "@/src/lib/format";

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

/** How many of the employee's most recent requests the dashboard shows. */
const RECENT_LIMIT = 5;

/**
 * Today's date, in the viewer's own timezone.
 *
 * Read in an effect rather than during render: `new Date()` depends on the
 * clock, and a server-rendered string would not match the one the browser
 * produces, which React reports as a hydration mismatch. `null` until then, and
 * the header simply omits the date for that first paint.
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

/**
 * Counts one slice of the signed-in employee's requests without transferring any
 * rows.
 *
 * `countRequestsByStatus` in `@/src/lib/queries` is the same shape but scoped to
 * every request in the system, which is what the approver dashboards need. This
 * variant adds the owner filter that Row Level Security would otherwise leave
 * implicit, so an employee's cards describe their own requests and nobody else's.
 */
async function countOwnRequests(
  supabase: SupabaseClient,
  ownerId: string,
  status?: string
) {
  let query = supabase
    .from("purchase_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", ownerId);

  if (status) {
    query = query.eq("status", status);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Request count failed:", error);

    return 0;
  }

  return count ?? 0;
}

export default function DashboardPage() {
  // The session and the profile row are already resolved by ProfileProvider in
  // the app shell, so this page reuses them instead of re-fetching the same
  // data. A profile edit is therefore reflected in the greeting below without
  // an extra round trip or a manual refresh.
  const { user, profile } = useProfile();

  const [recentRequests, setRecentRequests] = useState<PurchaseRequest[]>([]);
  const [counts, setCounts] = useState<{
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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const today = useToday();

  /**
   * The employee's most recent requests, and the counts behind the cards.
   *
   * The two are separate queries on purpose. `limit(RECENT_LIMIT)` fetches only
   * the handful of rows the dashboard actually renders, while the four counts are
   * `head` queries that return a number and no rows — so the cards keep
   * describing every request the employee has ever made instead of silently
   * describing the last five. Deriving the counts from the visible rows, as this
   * page used to, made the totals wrong for anyone with more than five requests.
   */
  const loadDashboard = useCallback(async () => {
    const supabase = createClient();

    try {
      setError("");

      if (!user) {
        throw new Error("You are not authenticated.");
      }

      const [recentResult, totalCount, pendingCount, approvedCount, rejectedCount] =
        await Promise.all([
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
                submitted_at
              `
            )
            .eq("requested_by", user.id)
            .order("submitted_at", { ascending: false })
            .limit(RECENT_LIMIT),
          countOwnRequests(supabase, user.id),
          countOwnRequests(supabase, user.id, "pending"),
          countOwnRequests(supabase, user.id, "approved"),
          countOwnRequests(supabase, user.id, "rejected"),
        ]);

      if (recentResult.error) {
        console.error("Requests error:", recentResult.error);

        throw new Error(recentResult.error.message);
      }

      setRecentRequests(recentResult.data ?? []);
      setCounts({
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      });
    } catch (err) {
      console.error("Dashboard error:", err);

      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  // ==========================================
  // REFETCH WHEN THE PAGE REGAINS FOCUS
  // ==========================================
  useEffect(() => {
    function handleFocus() {
      setRefreshing(true);
      void loadDashboard();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadDashboard]);

  const displayName = profile?.full_name?.trim() || "there";

  const summary = useMemo(() => {
    if (counts.pending == null || counts.approved == null) {
      return "Here is the current state of your purchase requests.";
    }

    if (counts.pending > 0) {
      return `You have ${counts.pending} ${
        counts.pending === 1 ? "request" : "requests"
      } waiting for a decision.`;
    }

    if (counts.approved && counts.approved > 0) {
      return `Nothing is waiting right now. ${counts.approved} ${
        counts.approved === 1 ? "request has" : "requests have"
      } been approved.`;
    }

    return "Nothing is waiting for review right now.";
  }, [counts.pending, counts.approved]);

  const quickActions = [
    {
      label: "Create Request",
      description: "Submit a new purchase request for approval.",
      href: "/employee/requests/create",
      icon: FilePlus2,
    },
    {
      label: "My Requests",
      description: "Track the status of everything you have submitted.",
      href: "/employee/requests",
      icon: Receipt,
    },
    {
      label: "My Profile",
      description: "Check your name, employee ID and account details.",
      href: "/employee/profile",
      icon: UserRound,
    },
  ];

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        <ListSkeleton />
      </div>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <PageHeader title="Dashboard" />

        <div className="mt-6">
          <ErrorState message={error} onRetry={loadDashboard} />
        </div>
      </div>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* ========================================
          WELCOME
      ======================================== */}
      <PageHeader
        title={`Welcome back, ${displayName}`}
        description={summary}
      >
        <Button render={<Link href="/employee/requests/create" />}>
          <FilePlus2 />
          New Request
        </Button>
      </PageHeader>

      {today && (
        <p className="-mt-4 text-xs text-muted-foreground">{today}</p>
      )}

      {/* ========================================
          SUMMARY
      ======================================== */}
      <section aria-label="Request summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Requests"
            value={counts.total}
            icon={TrendingUp}
            tone="primary"
            hint="All time"
            href="/employee/requests"
          />

          <StatCard
            label="Pending"
            value={counts.pending}
            icon={FileClock}
            tone="pending"
            hint="Awaiting review"
          />

          <StatCard
            label="Approved"
            value={counts.approved}
            icon={BadgeCheck}
            tone="approved"
            hint="Cleared for purchase"
          />

          <StatCard
            label="Rejected"
            value={counts.rejected}
            icon={CircleX}
            tone="rejected"
            hint="Needs resubmission"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ========================================
            RECENT REQUESTS
        ======================================== */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Recent Requests
              </h2>

              <p className="text-sm text-muted-foreground">
                Your {RECENT_LIMIT} most recent submissions.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/employee/requests" />}
            >
              View All
              <ArrowRight />
            </Button>
          </div>

          {recentRequests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No purchase requests yet"
              description="Create your first request when you need to purchase items or services."
              action={
                <Button render={<Link href="/employee/requests/create" />}>
                  <FilePlus2 />
                  Create your first request
                </Button>
              }
            />
          ) : (
            <div
              className={cn(refreshing && "opacity-60")}
              aria-busy={refreshing}
            >
              <Card>
                <CardContent className="space-y-3 py-4">
                  {recentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {request.title}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {request.request_number}
                        </p>

                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {request.purpose}
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
                          variant="ghost"
                          size="sm"
                          render={
                            <Link href={`/employee/requests/${request.id}`} />
                          }
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </section>

        {/* ========================================
            QUICK ACTIONS
        ======================================== */}
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
        </aside>
      </div>
    </div>
  );
}
