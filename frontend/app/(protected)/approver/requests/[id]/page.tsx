"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { friendlyError } from "@/src/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
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
  requested_by: string;
};

type RequestItem = {
  id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  estimated_unit_price: number;
  estimated_total: number;
};

type RequesterProfile = {
  full_name: string;
  employee_id: string | null;
  department_id: string | null;
};

type Department = {
  name: string;
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

export default function ApproverRequestDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const requestId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const [request, setRequest] =
    useState<RequestData | null>(null);

  const [items, setItems] =
    useState<RequestItem[]>([]);

  const [requester, setRequester] =
    useState<RequesterProfile | null>(null);

  const [department, setDepartment] =
    useState<Department | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // Tracked separately so only the button the user actually pressed shows a
  // spinner, and so the two actions cannot race each other.
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const actionLoading = approving || rejecting;

  const [rejectionReason, setRejectionReason] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  // ==========================================
  // LOAD REQUEST BY ID
  // ==========================================
  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setError("Invalid request ID.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      setLoading(true);
      setError("");

      // --------------------------------
      // Authentication
      // --------------------------------
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          friendlyError(authError, "Authentication failed. Please sign in again.")
        );
      }

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }
      // --------------------------------
      // Get request by ID
      // --------------------------------
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
            purpose,
            priority,
            status,
            total_amount,
            submitted_at,
            requested_by
          `
        )
        .eq("id", requestId)
        .maybeSingle();

      if (requestError) {
        console.error(
          "Request error:",
          requestError
        );

        throw new Error(
          friendlyError(requestError, "Failed to load the request.")
        );
      }

      if (!requestData) {
        throw new Error(
          "Purchase request not found."
        );
      }

      setRequest(requestData);

      // --------------------------------
      // Get request items using request ID
      // --------------------------------
      const {
        data: itemData,
        error: itemError,
      } = await supabase
        .from("purchase_request_items")
        .select(
          `
            id,
            item_name,
            description,
            quantity,
            estimated_unit_price,
            estimated_total
          `
        )
        .eq("request_id", requestData.id)
        .order("created_at", {
          ascending: true,
        });

      if (itemError) {
        console.error(
          "Items error:",
          itemError
        );

        throw new Error(
          friendlyError(itemError, "Failed to load the request items.")
        );
      }

      setItems(itemData ?? []);

      // --------------------------------
      // Get requester using requested_by
      // --------------------------------
      const {
        data: requesterData,
        error: requesterError,
      } = await supabase
        .from("profiles")
        .select(
          `
            full_name,
            employee_id,
            department_id
          `
        )
        .eq(
          "id",
          requestData.requested_by
        )
        .maybeSingle();

      if (requesterError) {
        console.error(
          "Requester error:",
          requesterError
        );
      } else {
        setRequester(
          requesterData ?? null
        );
      }

      // --------------------------------
      // Get department
      // --------------------------------
      if (requesterData?.department_id) {
        const {
          data: departmentData,
          error: departmentError,
        } = await supabase
          .from("departments")
          .select("name")
          .eq(
            "id",
            requesterData.department_id
          )
          .maybeSingle();

        if (departmentError) {
          console.error(
            "Department error:",
            departmentError
          );
        } else {
          setDepartment(
            departmentData ?? null
          );
        }
      } else {
        setDepartment(null);
      }
    } catch (err) {
      console.error(
        "Load request error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load request."
      );
    } finally {
      setLoading(false);
    }
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
  }, [loadRequest]);

  // ==========================================
  // APPROVE
  // ==========================================
  async function handleApprove() {
    if (actionLoading) {
      return;
    }

    if (!request) {
      setActionError(
        "Request data is not available."
      );
      return;
    }

    const supabase = createClient();

    setApproving(true);
    setActionError("");

    try {
      // --------------------------------
      // Authentication
      // --------------------------------
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          friendlyError(authError, "Authentication failed. Please sign in again.")
        );
      }

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }

      // --------------------------------
      // Make sure request is still pending
      // --------------------------------
      if (request.status !== "pending") {
        throw new Error(
          `This request is already ${request.status}.`
        );
      }

      // --------------------------------
      // Approve request
      //
      // `select(...)` is essential here. Without it PostgREST reports success
      // even when zero rows were updated, so a write that was filtered out by
      // Row Level Security -- or one lost to a concurrent approver -- would be
      // shown to the user as a successful approval. Selecting the updated row
      // lets us detect that case and report it honestly.
      // --------------------------------
      const {
        data: updatedRequest,
        error: updateError,
      } = await supabase
        .from("purchase_requests")
        .update({
          status: "approved",
          reviewed_at:
            new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", request.id)
        .eq("status", "pending")
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        console.error(
          "Approve request error:",
          updateError
        );

        throw new Error(
          friendlyError(updateError, "Unable to update the request.")
        );
      }

      if (!updatedRequest) {
        throw new Error(
          "This request could not be approved. It may have been handled by another approver already."
        );
      }

      // --------------------------------
      // Create approval log
      // --------------------------------
      const {
        error: logError,
      } = await supabase
        .from("approval_logs")
        .insert({
          request_id: request.id,
          approver_id: user.id,
          action: "approved",
          remarks:
            "Purchase request approved.",
        });

      if (logError) {
        console.error(
          "Approval log error:",
          logError
        );

        throw new Error(
          friendlyError(
            logError,
            "Request was approved, but the approval log could not be saved."
          )
        );
      }

      // Reflect the new status locally so the screen is accurate even before
      // the redirect finishes.
      setRequest((previous) =>
        previous
          ? {
              ...previous,
              status: updatedRequest.status,
            }
          : previous
      );

      // --------------------------------
      // Go back to dashboard
      // --------------------------------
      router.replace(
        "/approver/dashboard"
      );
      router.refresh();
    } catch (err) {
      console.error(
        "Approve error:",
        err
      );

      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to approve request."
      );
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (actionLoading) {
      return;
    }

    if (!request) {
      setActionError("Request data is not available.");
      return;
    }

    const reason = rejectionReason.trim();

    if (!reason) {
      setActionError(
        "Please provide a reason for rejection."
      );
      return;
    }

    const supabase = createClient();

    setRejecting(true);
    setActionError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          friendlyError(authError, "Authentication failed. Please sign in again.")
        );
      }

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }

      const {
        data: isApprover,
        error: approverError,
      } = await supabase.rpc("is_approver");

      if (approverError) {
        throw new Error(
          friendlyError(
            approverError,
            "Unable to verify your approver role."
          )
        );
      }

      if (!isApprover) {
        throw new Error(
          "You are not authorized to reject purchase requests."
        );
      }

      if (request.status !== "pending") {
        throw new Error(
          `This request is already ${request.status}.`
        );
      }

      const {
        data: updatedRequest,
        error: updateError,
      } = await supabase
        .from("purchase_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", request.id)
        .eq("status", "pending")
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        console.error(
          "Reject request error:",
          updateError
        );

        throw new Error(
          friendlyError(updateError, "Unable to update the request.")
        );
      }

      if (!updatedRequest) {
        throw new Error(
          "The purchase request could not be rejected."
        );
      }

      const {
        error: logError,
      } = await supabase
        .from("approval_logs")
        .insert({
          request_id: request.id,
          approver_id: user.id,
          action: "rejected",
          remarks: reason,
        });

      if (logError) {
        console.error(
          "Rejection log error:",
          logError
        );

        throw new Error(
          friendlyError(
            logError,
            "Request was rejected, but the rejection log could not be saved."
          )
        );
      }

      router.replace(
        "/approver/dashboard"
      );

      router.refresh();
    } catch (err) {
      console.error(
        "Reject error:",
        err
      );

      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to reject request."
      );
    } finally {
      setRejecting(false);
    }
  }
  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Approver Dashboard
        </Button>

        <PageHeader title="Request Details" />
        <CardSkeleton />
      </div>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Approver Dashboard
        </Button>

        <PageHeader title="Request Details" />

        <ErrorState message={error} onRetry={loadRequest} />
      </div>
    );
  }

  // ==========================================
  // REQUEST NOT FOUND
  // ==========================================
  if (!request) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <EmptyState
          icon={Inbox}
          title="Request Not Found"
          description="This purchase request could not be found."
          action={
            <Button
              variant="outline"
              render={<Link href="/approver/dashboard" />}
            >
              <ArrowLeft />
              Back to Approver Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Back */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Approver Dashboard
        </Button>

        {/* Header */}
        <PageHeader
          title="Request Details"
          description={request.request_number}
        >
          <div className="flex items-center gap-2">
            <PriorityBadge priority={request.priority} />
            <StatusBadge status={request.status} />
          </div>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Request Information */}
          <Card>
            <CardHeader>
              <CardTitle>Request Information</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 border-t border-border pt-4">
              <dl className="space-y-3">
                <DetailRow label="Request Number">
                  {request.request_number}
                </DetailRow>

                <DetailRow label="Title">{request.title}</DetailRow>

                <DetailRow label="Purpose">{request.purpose}</DetailRow>

                <DetailRow label="Submitted">
                  {formatDateTime(request.submitted_at)}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>

          {/* Requester */}
          <Card>
            <CardHeader>
              <CardTitle>Requester</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 border-t border-border pt-4">
              <dl className="space-y-3">
                <DetailRow label="Name">
                  {requester?.full_name || "Unknown"}
                </DetailRow>

                <DetailRow label="Employee ID">
                  {requester?.employee_id || "Not assigned"}
                </DetailRow>

                <DetailRow label="Department">
                  {department?.name || "Not assigned"}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>

          {/* Items */}
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

        {/* Total and Actions */}
        <div className="space-y-6">
          <Card className="bg-muted/40">
            <CardContent className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Amount</span>

                <span className="text-lg font-bold text-foreground tabular-nums">
                  {formatAmount(request.total_amount)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Review actions only when pending */}
          {request.status === "pending" ? (
            <Card className="self-start">
              <CardHeader>
                <CardTitle>Review Request</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 border-t border-border pt-4">
                {actionError && <ErrorState message={actionError} />}

                <div className="space-y-2">
                  <Label htmlFor="rejectionReason">
                    Rejection Reason
                  </Label>

                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                    placeholder="Enter reason if rejecting this request..."
                    rows={4}
                    disabled={actionLoading}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="bg-success text-success-foreground hover:bg-success/90"
                  >
                    <CheckCircle2 />
                    {approving
                      ? "Approving..."
                      : "Approve Request"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <XCircle />
                    {rejecting
                      ? "Rejecting..."
                      : "Reject Request"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="self-start bg-muted/40">
              <CardContent className="flex items-start gap-3 py-4">
                <StatusBadge status={request.status} />

                <p className="text-sm text-muted-foreground">
                  This request has already been{" "}
                  {request.status}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}