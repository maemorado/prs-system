"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { friendlyError } from "@/src/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Inbox } from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { PriorityBadge, StatusBadge } from "@/src/components/shared/badges";
import { CardSkeleton, EmptyState, ErrorState } from "@/src/components/shared/state";
import { formatAmount, formatDateTime } from "@/src/lib/format";

type RequestData = {
  id: string;
  request_number: string;
  title: string;
  purpose: string;
  priority: string;
  status: string;
  total_amount: number;
  submitted_at: string;
};

type RequestItem = {
  id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  estimated_unit_price: number;
  estimated_total: number;
  category_id: string | null;
};

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4 sm:grid-cols-[160px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default function RequestDetailsPage() {
  const params = useParams();
  const requestId = params.id as string;

  const [request, setRequest] = useState<RequestData | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequest = useCallback(async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You are not authenticated.");
        setLoading(false);
        return;
      }

      const { data: requestData, error: requestError } = await supabase
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
        .eq("id", requestId)
        .eq("requested_by", user.id)
        .single();

      if (requestError) {
        console.error("Request error:", requestError);
        setError(friendlyError(requestError, "Failed to load the request."));
        setLoading(false);
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("purchase_request_items")
        .select(
          `
          id,
          item_name,
          description,
          quantity,
          estimated_unit_price,
          estimated_total,
          category_id
        `
        )
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (itemError) {
        console.error("Items error:", itemError);
        setError(friendlyError(itemError, "Failed to load the request items."));
        setLoading(false);
        return;
      }

      setRequest(requestData);
      setItems(itemData ?? []);
      setLoading(false);
    }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequest();
  }, [loadRequest]);

  // ==========================================
  // REFETCH WHEN THE PAGE REGAINS FOCUS
  // ==========================================
  useEffect(() => {
    function handleFocus() {
      loadRequest();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadRequest]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Request Details" />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Request Details" />
        <ErrorState message={error} onRetry={loadRequest} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <EmptyState
          icon={Inbox}
          title="Request not found"
          description="This request could not be found or you don't have access to it."
          action={
            <Button
              variant="outline"
              render={<Link href="/employee/requests" />}
            >
              <ArrowLeft />
              Back to My Requests
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/employee/requests" />}
        >
          <ArrowLeft />
          Back to My Requests
        </Button>

        <PageHeader title="Request Details">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={request.priority} />
            <StatusBadge status={request.status} />
          </div>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{request.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 border-t border-border pt-4">
              <dl className="space-y-3">
                <DetailRow label="Request Number">
                  {request.request_number}
                </DetailRow>

                <DetailRow label="Purpose">{request.purpose}</DetailRow>

                <DetailRow label="Submitted">
                  {formatDateTime(request.submitted_at)}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requested Items</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 border-t border-border pt-4">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items found.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-lg border border-border p-4"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {item.item_name}
                      </p>

                      {item.description && (
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-border pt-2">
                        <span className="text-sm text-muted-foreground">
                          Qty: {item.quantity} ×{" "}
                          {formatAmount(item.estimated_unit_price)}
                        </span>

                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatAmount(item.estimated_total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="self-start bg-muted/40">
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Amount</span>

              <span className="text-lg font-bold text-foreground tabular-nums">
                {formatAmount(request.total_amount)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}