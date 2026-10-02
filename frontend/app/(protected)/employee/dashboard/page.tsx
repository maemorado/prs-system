"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FilePlus2,
  Inbox,
  TrendingUp,
  FileClock,
  BadgeCheck,
  CircleX,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatCard } from "@/src/components/shared/stat-card";
import { StatusBadge } from "@/src/components/shared/badges";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { formatAmount, formatDate } from "@/src/lib/format";

type PurchaseRequest = {
  id: string;
  request_number: string;
  title: string;
  status: string;
  total_amount: number;
  submitted_at: string;
};

export default function DashboardPage() {
  // The session and the profile row are already resolved by ProfileProvider in
  // the app shell, so this page reuses them instead of re-fetching the same
  // data. A profile edit is therefore reflected in the greeting below without
  // an extra round trip or a manual refresh.
  const { user, profile } = useProfile();

  const [requests, setRequests] =
    useState<PurchaseRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadDashboard = useCallback(async () => {
    const supabase = createClient();

    try {
      setLoading(true);
      setError("");

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }

      // ==========================================
      // GET THIS EMPLOYEE'S REQUESTS
      // ==========================================
      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("purchase_requests")
        .select(
          `
            id,
            request_number,
            title,
            status,
            total_amount,
            submitted_at
          `
        )
        // IMPORTANT:
        // Only show requests created
        // by the logged-in employee.
        .eq("requested_by", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        console.error(
          "Requests error:",
          requestError
        );

        throw new Error(
          requestError.message
        );
      }

      setRequests(
        requestData ?? []
      );
    } catch (err) {
      console.error(
        "Dashboard error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard."
      );
    } finally {
      setLoading(false);
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
      loadDashboard();
    }

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, [loadDashboard]);

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
  // STATISTICS
  // ==========================================
  const totalRequests =
    requests.length;

  const pendingRequests =
    requests.filter(
      (request) =>
        request.status === "pending"
    ).length;

  const approvedRequests =
    requests.filter(
      (request) =>
        request.status === "approved"
    ).length;

  const rejectedRequests =
    requests.filter(
      (request) =>
        request.status === "rejected"
    ).length;

  // Only show the five most recent requests.
  const recentRequests =
    requests.slice(0, 5);

  // ==========================================
  // PAGE
  // ==========================================
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* ========================================
          WELCOME
      ======================================== */}
      <PageHeader
        title={`Welcome back, ${profile?.full_name || "Employee"}`}
        description={`Here's an overview of your purchase requests.${profile?.employee_id ? ` Employee ID: ${profile.employee_id}` : ""}`}
      >
        <Button
          render={
            <Link href="/employee/requests/create" />
          }
        >
          <FilePlus2 />
          New Request
        </Button>
      </PageHeader>

      {/* ========================================
          STATISTICS
      ======================================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Requests"
          value={totalRequests}
          icon={TrendingUp}
          tone="primary"
        />

        <StatCard
          label="Pending"
          value={pendingRequests}
          icon={FileClock}
          tone="pending"
        />

        <StatCard
          label="Approved"
          value={approvedRequests}
          icon={BadgeCheck}
          tone="approved"
        />

        <StatCard
          label="Rejected"
          value={rejectedRequests}
          icon={CircleX}
          tone="rejected"
        />
      </div>

      {/* ========================================
          RECENT REQUESTS
      ======================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Requests
          </h2>

          {requests.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/employee/requests" />}
            >
              View All
            </Button>
          )}
        </div>

        {recentRequests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No purchase requests yet"
            description="Create your first request when you need to purchase items or services."
            action={
              <Button
                render={
                  <Link href="/employee/requests/create" />
                }
              >
                <FilePlus2 />
                Create your first request
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {recentRequests.map(
              (request) => (
                <Link
                  key={request.id}
                  href={`/employee/requests/${request.id}`}
                  className="block transition-colors"
                >
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {request.title}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {request.request_number}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Submitted: {formatDate(request.submitted_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center sm:gap-1.5">
                        <StatusBadge status={request.status} />

                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {formatAmount(request.total_amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}