"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";

type Profile = {
  full_name: string;
  employee_id: string | null;
};

type PurchaseRequest = {
  id: string;
  request_number: string;
  title: string;
  status: string;
  total_amount: number;
  submitted_at: string;
};

export default function DashboardPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

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

      // ==========================================
      // GET AUTHENTICATED USER
      // ==========================================
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

      // ==========================================
      // GET EMPLOYEE PROFILE
      // ==========================================
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "full_name, employee_id"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Profile error:",
          profileError
        );

        throw new Error(
          profileError.message
        );
      }

      setProfile(
        profileData ?? null
      );

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
  }, []);

  useEffect(() => {
    loadDashboard();
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
      <main style={{ padding: "24px" }}>
        <p>Loading dashboard...</p>
      </main>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================
  if (error) {
    return (
      <main style={{ padding: "24px" }}>
        <h1>Dashboard</h1>

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            color: "#b91c1c",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      </main>
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
    <main
      style={{
        padding: "24px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      {/* ========================================
          WELCOME
      ======================================== */}
      <section>
        <h1>
          Welcome,{" "}
          {profile?.full_name ||
            "Employee"}
        </h1>

        {profile?.employee_id && (
          <p>
            Employee ID:{" "}
            {profile.employee_id}
          </p>
        )}

        <p>
          Here's an overview of your
          purchase requests.
        </p>
      </section>

      {/* ========================================
          STATISTICS
      ======================================== */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginTop: "30px",
        }}
      >
        {/* Total */}
        <div
          style={{
            padding: "20px",
            border:
              "1px solid #ddd",
            borderRadius: "10px",
          }}
        >
          <p>Total Requests</p>

          <h2>
            {totalRequests}
          </h2>
        </div>

        {/* Pending */}
        <div
          style={{
            padding: "20px",
            border:
              "1px solid #ddd",
            borderRadius: "10px",
          }}
        >
          <p>Pending</p>

          <h2>
            {pendingRequests}
          </h2>
        </div>

        {/* Approved */}
        <div
          style={{
            padding: "20px",
            border:
              "1px solid #ddd",
            borderRadius: "10px",
          }}
        >
          <p>Approved</p>

          <h2>
            {approvedRequests}
          </h2>
        </div>

        {/* Rejected */}
        <div
          style={{
            padding: "20px",
            border:
              "1px solid #ddd",
            borderRadius: "10px",
          }}
        >
          <p>Rejected</p>

          <h2>
            {rejectedRequests}
          </h2>
        </div>
      </section>

      {/* ========================================
          RECENT REQUESTS
      ======================================== */}
      <section
        style={{
          marginTop: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >
          <h2>
            Recent Requests
          </h2>

          <Link href="/employee/requests">
            View All
          </Link>
        </div>

        {/* ======================================
            NO REQUESTS
        ====================================== */}
        {recentRequests.length ===
        0 ? (
          <div
            style={{
              marginTop: "15px",
              padding: "20px",
              border:
                "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            <p>
              No purchase requests
              yet.
            </p>

            <Link href="/employee/requests/create">
              Create your first
              request
            </Link>
          </div>
        ) : (
          /* ====================================
             REQUEST LIST
          ==================================== */
          <div
            style={{
              marginTop: "15px",
            }}
          >
            {recentRequests.map(
              (request) => (
                <Link
                      key={request.id}
                      href={`/employee/requests/${request.id}`}
                  style={{
                    display: "block",
                    textDecoration:
                      "none",
                    color: "inherit",
                    marginBottom:
                      "12px",
                  }}
                >
                  <div
                    style={{
                      padding: "18px",
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "10px",
                    }}
                  >
                    {/* Request header */}
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: "20px",
                      }}
                    >
                      <div>
                        <h3>
                          {
                            request.title
                          }
                        </h3>

                        <p
                          style={{
                            color:
                              "#666",
                          }}
                        >
                          {
                            request.request_number
                          }
                        </p>
                      </div>

                      <strong>
                        {
                          request.status
                        }
                      </strong>
                    </div>

                    {/* Request information */}
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        marginTop:
                          "10px",
                        gap: "20px",
                      }}
                    >
                      <span>
                        Submitted:{" "}
                        {new Date(
                          request.submitted_at
                        ).toLocaleDateString()}
                      </span>

                      <strong>
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
                  </div>
                </Link>
              )
            )}
          </div>
        )}
      </section>

      {/* ========================================
          CREATE REQUEST
      ======================================== */}
      <section
        style={{
          marginTop: "30px",
        }}
      >
        <Link
          href="/employee/requests/create"
          style={{
            display: "inline-block",
            padding: "12px 18px",
            backgroundColor:
              "#2563eb",
            color: "#fff",
            textDecoration:
              "none",
            borderRadius: "6px",
          }}
        >
          Create Purchase Request
        </Link>
      </section>
    </main>
  );
}
