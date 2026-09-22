"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";

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

  function formatPriority(priority: string) {
    if (!priority) {
      return "Unknown";
    }

    return (
      priority.charAt(0).toUpperCase() +
      priority.slice(1).toLowerCase()
    );
  }

  function formatStatus(status: string) {
    if (!status) {
      return "Unknown";
    }

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1).toLowerCase()
    );
  }

  function getStatusStyles(status: string) {
    switch (status.toLowerCase()) {
      case "approved":
        return {
          backgroundColor: "#dcfce7",
          color: "#15803d",
        };

      case "rejected":
        return {
          backgroundColor: "#fee2e2",
          color: "#b91c1c",
        };

      case "pending":
        return {
          backgroundColor: "#fff7ed",
          color: "#c2410c",
        };

      default:
        return {
          backgroundColor: "#f3f4f6",
          color: "#374151",
        };
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority.toLowerCase()) {
      case "high":
        return "#dc2626";

      case "medium":
        return "#d97706";

      case "low":
        return "#16a34a";

      default:
        return "#555";
    }
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
      <main style={{ padding: "24px" }}>
        <h1>Approver Dashboard</h1>
        <p>Loading purchase requests...</p>
      </main>
    );
  }

  /*
   * Error
   */
  if (error) {
    return (
      <main style={{ padding: "24px" }}>
        <h1>Approver Dashboard</h1>

        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            border: "1px solid #fecaca",
            backgroundColor: "#fef2f2",
            borderRadius: "10px",
            color: "#b91c1c",
          }}
        >
          <strong>
            Failed to load requests
          </strong>

          <p style={{ marginTop: "8px" }}>
            {error}
          </p>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              marginTop: "10px",
              padding: "10px 16px",
              cursor: refreshing
                ? "not-allowed"
                : "pointer",
            }}
          >
            {refreshing
              ? "Retrying..."
              : "Try Again"}
          </button>
        </div>
      </main>
    );
  }

  /*
   * Dashboard
   */
  return (
    <main
      style={{
        padding: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Approver Dashboard</h1>

          <p
            style={{
              marginTop: "8px",
              color: "#666",
            }}
          >
            Review and monitor purchase requests.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: "10px 16px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            backgroundColor: "#fff",
            cursor: refreshing
              ? "not-allowed"
              : "pointer",
          }}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh Requests"}
        </button>
      </div>

      {/* Statistics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginTop: "30px",
        }}
      >
        {/* Pending */}
        <div
          style={{
            padding: "20px",
            border: "1px solid #ddd",
            borderRadius: "10px",
            backgroundColor: "#fff",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#666",
            }}
          >
            Pending Requests
          </p>

          <h2
            style={{
              marginTop: "8px",
              marginBottom: 0,
            }}
          >
            {pendingCount}
          </h2>
        </div>

        {/* Approved */}
        <div
          style={{
            padding: "20px",
            border: "1px solid #ddd",
            borderRadius: "10px",
            backgroundColor: "#fff",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#666",
            }}
          >
            Approved Requests
          </p>

          <h2
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#15803d",
            }}
          >
            {approvedCount}
          </h2>
        </div>

        {/* Rejected */}
        <div
          style={{
            padding: "20px",
            border: "1px solid #ddd",
            borderRadius: "10px",
            backgroundColor: "#fff",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#666",
            }}
          >
            Rejected Requests
          </p>

          <h2
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#b91c1c",
            }}
          >
            {rejectedCount}
          </h2>
        </div>
      </div>

      {/* All Requests */}
      <section style={{ marginTop: "40px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <h2>Purchase Requests</h2>

          <span
            style={{
              fontSize: "14px",
              color: "#666",
            }}
          >
            {requests.length}{" "}
            {requests.length === 1
              ? "request"
              : "requests"}
          </span>
        </div>

        {requests.length === 0 ? (
          <div
            style={{
              marginTop: "20px",
              padding: "30px",
              border: "1px solid #ddd",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            <h3>No Purchase Requests</h3>

            <p
              style={{
                marginTop: "8px",
                color: "#666",
              }}
            >
              There are currently no purchase
              requests.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: "20px" }}>
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/approver/requests/${request.id}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  marginBottom: "15px",
                }}
              >
                <div
                  style={{
                    padding: "20px",
                    border: "1px solid #ddd",
                    borderRadius: "10px",
                    backgroundColor: "#fff",
                  }}
                >
                  {/* Top section */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "flex-start",
                      gap: "20px",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                        }}
                      >
                        {request.title}
                      </h3>

                      <p
                        style={{
                          marginTop: "6px",
                          fontSize: "14px",
                          color: "#666",
                        }}
                      >
                        {request.request_number}
                      </p>

                      <p
                        style={{
                          marginTop: "10px",
                        }}
                      >
                        {request.purpose}
                      </p>
                    </div>

                    {/* Status */}
                    <span
                      style={{
                        ...getStatusStyles(
                          request.status
                        ),
                        padding:
                          "6px 10px",
                        borderRadius:
                          "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {formatStatus(
                        request.status
                      )}
                    </span>
                  </div>

                  {/* Bottom information */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: "20px",
                      marginTop: "20px",
                      paddingTop: "15px",
                      borderTop:
                        "1px solid #eee",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          color: "#666",
                        }}
                      >
                        Priority:
                      </span>{" "}
                      <strong
                        style={{
                          color:
                            getPriorityColor(
                              request.priority
                            ),
                        }}
                      >
                        {formatPriority(
                          request.priority
                        )}
                      </strong>
                    </div>

                    <strong
                      style={{
                        fontSize: "18px",
                      }}
                    >
                      ₱
                      {Number(
                        request.total_amount
                      ).toLocaleString(
                        "en-PH",
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </strong>
                  </div>

                  {/* Submitted */}
                  <p
                    style={{
                      marginTop: "12px",
                      marginBottom: 0,
                      fontSize: "14px",
                      color: "#666",
                    }}
                  >
                    Submitted:{" "}
                    {new Date(
                      request.submitted_at
                    ).toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}