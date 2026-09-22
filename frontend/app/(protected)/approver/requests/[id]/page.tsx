"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

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

  const [actionLoading, setActionLoading] =
    useState(false);

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
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }
      console.log("AUTH USER ID:", user.id);
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
          requestError.message
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
          itemError.message
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

    setActionLoading(true);
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
          authError.message
        );
      }

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }
      console.log("AUTH USER ID:", user.id);

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
      // --------------------------------
      const {
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
        .eq("status", "pending");

      if (updateError) {
        console.error(
          "Approve request error:",
          updateError
        );

        throw new Error(
          updateError.message
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
          `Request was approved, but the approval log failed: ${logError.message}`
        );
      }

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

      setActionLoading(false);
    }
  }

  // ==========================================
  // REJECT
  // ==========================================
  async function handleReject() {
    if (actionLoading) {
      return;
    }

    if (!request) {
      setActionError(
        "Request data is not available."
      );
      return;
    }

    const reason =
      rejectionReason.trim();

    if (!reason) {
      setActionError(
        "Please provide a reason for rejection."
      );
      return;
    }

    const supabase = createClient();

    setActionLoading(true);
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
          authError.message
        );
      }

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }
      console.log("AUTH USER ID:", user.id);
        const {
        data: isApprover,
        error: approverError,
        } = await supabase.rpc("is_approver");

        console.log("========== RLS DEBUG ==========");
        console.log("AUTH USER ID:", user.id);
        console.log("IS APPROVER:", isApprover);
        console.log("APPROVER ERROR:", approverError);
        console.log("================================");
      // --------------------------------
      // Make sure request is still pending
      // --------------------------------
      if (request.status !== "pending") {
        throw new Error(
          `This request is already ${request.status}.`
        );
      }

      // --------------------------------
      // Reject request
      // --------------------------------
      const {
        error: updateError,
      } = await supabase
        .from("purchase_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at:
            new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", request.id)
        .eq("status", "pending");

      if (updateError) {
        console.error(
          "Reject request error:",
          updateError
        );

        throw new Error(
          updateError.message
        );
      }

      // --------------------------------
      // Create rejection log
      // --------------------------------
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
          `Request was rejected, but the rejection log failed: ${logError.message}`
        );
      }

      // --------------------------------
      // Go back to dashboard
      // --------------------------------
      router.push(
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

      setActionLoading(false);
    }
  }

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <main style={{ padding: "24px" }}>
        <Link href="/approver/dashboard">
          ← Back to Approver Dashboard
        </Link>

        <p style={{ marginTop: "25px" }}>
          Loading request...
        </p>
      </main>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================
  if (error) {
    return (
      <main style={{ padding: "24px" }}>
        <Link href="/approver/dashboard">
          ← Back to Approver Dashboard
        </Link>

        <h1
          style={{
            marginTop: "25px",
          }}
        >
          Request Details
        </h1>

        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            color: "#b91c1c",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
          }}
        >
          {error}
        </div>
      </main>
    );
  }

  // ==========================================
  // REQUEST NOT FOUND
  // ==========================================
  if (!request) {
    return (
      <main style={{ padding: "24px" }}>
        <Link href="/approver/dashboard">
          ← Back to Approver Dashboard
        </Link>

        <h1
          style={{
            marginTop: "25px",
          }}
        >
          Request Not Found
        </h1>
      </main>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================
  return (
    <main
      style={{
        padding: "24px",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      {/* Back */}
      <Link href="/approver/dashboard">
        ← Back to Approver Dashboard
      </Link>

      {/* Header */}
      <div style={{ marginTop: "25px" }}>
        <h1>Request Details</h1>

        <p
          style={{
            marginTop: "6px",
            color: "#666",
          }}
        >
          {request.request_number}
        </p>
      </div>

      {/* Request Information */}
      <section
        style={{
          marginTop: "25px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "10px",
        }}
      >
        <h2>Request Information</h2>

        <div style={{ marginTop: "20px" }}>
          <p>
            <strong>Request Number:</strong>{" "}
            {request.request_number}
          </p>

          <p>
            <strong>Title:</strong>{" "}
            {request.title}
          </p>

          <p>
            <strong>Purpose:</strong>{" "}
            {request.purpose}
          </p>

          <p>
            <strong>Priority:</strong>{" "}
            {request.priority}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {request.status}
          </p>

          <p>
            <strong>Submitted:</strong>{" "}
            {new Date(
              request.submitted_at
            ).toLocaleString()}
          </p>
        </div>
      </section>

      {/* Requester */}
      <section
        style={{
          marginTop: "20px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "10px",
        }}
      >
        <h2>Requester</h2>

        <div style={{ marginTop: "20px" }}>
          <p>
            <strong>Name:</strong>{" "}
            {requester?.full_name ||
              "Unknown"}
          </p>

          <p>
            <strong>Employee ID:</strong>{" "}
            {requester?.employee_id ||
              "Not assigned"}
          </p>

          <p>
            <strong>Department:</strong>{" "}
            {department?.name ||
              "Not assigned"}
          </p>
        </div>
      </section>

      {/* Items */}
      <section
        style={{
          marginTop: "20px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "10px",
        }}
      >
        <h2>Requested Items</h2>

        <div style={{ marginTop: "20px" }}>
          {items.length === 0 ? (
            <p>No items found.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "16px",
                  marginBottom: "12px",
                  border: "1px solid #eee",
                  borderRadius: "8px",
                }}
              >
                <h3>
                  {item.item_name}
                </h3>

                {item.description && (
                  <p>
                    {item.description}
                  </p>
                )}

                <p>
                  <strong>
                    Quantity:
                  </strong>{" "}
                  {item.quantity}
                </p>

                <p>
                  <strong>
                    Unit Price:
                  </strong>{" "}
                  ₱
                  {Number(
                    item.estimated_unit_price
                  ).toLocaleString(
                    "en-PH",
                    {
                      minimumFractionDigits: 2,
                    }
                  )}
                </p>

                <p>
                  <strong>
                    Item Total:
                  </strong>{" "}
                  ₱
                  {Number(
                    item.estimated_total
                  ).toLocaleString(
                    "en-PH",
                    {
                      minimumFractionDigits: 2,
                    }
                  )}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Total and Actions */}
      <section
        style={{
          marginTop: "20px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "10px",
        }}
      >
        <h2>
          Total Amount: ₱
          {Number(
            request.total_amount
          ).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}
        </h2>

        {/* Review actions only when pending */}
        {request.status === "pending" && (
          <section
            style={{
              marginTop: "25px",
              padding: "24px",
              border: "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            <h2>Review Request</h2>

            {actionError && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "12px",
                  color: "#b91c1c",
                  backgroundColor:
                    "#fef2f2",
                  border:
                    "1px solid #fecaca",
                  borderRadius: "6px",
                }}
              >
                {actionError}
              </div>
            )}

            <div
              style={{
                marginTop: "20px",
              }}
            >
              <label htmlFor="rejectionReason">
                Rejection Reason
              </label>

              <textarea
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
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "8px",
                  padding: "10px",
                  border:
                    "1px solid #ccc",
                  borderRadius: "6px",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                style={{
                  padding:
                    "10px 16px",
                  border:
                    "1px solid #16a34a",
                  borderRadius: "6px",
                  backgroundColor:
                    "#16a34a",
                  color: "#fff",
                  cursor: actionLoading
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {actionLoading
                  ? "Processing..."
                  : "Approve Request"}
              </button>

              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                style={{
                  padding:
                    "10px 16px",
                  border:
                    "1px solid #dc2626",
                  borderRadius: "6px",
                  backgroundColor:
                    "#dc2626",
                  color: "#fff",
                  cursor: actionLoading
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {actionLoading
                  ? "Processing..."
                  : "Reject Request"}
              </button>
            </div>
          </section>
        )}

        {/* Already reviewed */}
        {request.status !== "pending" && (
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              backgroundColor: "#f5f5f5",
              borderRadius: "8px",
            }}
          >
            <strong>
              This request has already been{" "}
              {request.status}.
            </strong>
          </div>
        )}
      </section>
    </main>
  );
}
