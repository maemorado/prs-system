"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilePlus2, Inbox } from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { PriorityBadge, StatusBadge } from "@/src/components/shared/badges";
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

export default function RequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You are not authenticated.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
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
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load requests:", error);
      setError(error.message);
      setLoading(false);
      return;
    }

    setRequests(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequests();
  }, [loadRequests]);

  // ==========================================
  // REFETCH WHEN THE PAGE REGAINS FOCUS
  // ==========================================
  useEffect(() => {
    function handleFocus() {
      loadRequests();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadRequests]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="My Requests" />
        <ListSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="My Requests" />
        <ErrorState message={error} onRetry={loadRequests} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title="My Requests"
        description="View and track your purchase requests."
      >
        <Button
          render={<Link href="/employee/requests/create" />}
        >
          <FilePlus2 />
          Create Request
        </Button>
      </PageHeader>

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No purchase requests yet"
          description="You don't have any purchase requests yet. Create one to get started."
          action={
            <Button
              render={<Link href="/employee/requests/create" />}
            >
              <FilePlus2 />
              Create your first request
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
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
      )}
    </div>
  );
}