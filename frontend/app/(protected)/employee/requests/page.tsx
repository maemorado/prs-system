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
    return <p>Loading requests...</p>;
  }

  if (error) {
    return (
      <div>
        <h1>My Requests</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1>My Requests</h1>
          <p>View and track your purchase requests.</p>
        </div>

        <Link href="/employee/requests/create">
          Create Request
        </Link>
      </div>

      <div style={{ marginTop: "30px" }}>
        {requests.length === 0 ? (
          <div>
            <p>You don't have any purchase requests yet.</p>

            <Link href="/employee/requests/create">
              Create your first request
            </Link>
          </div>
        ) : (
          requests.map((request) => (
            <Link
              key={request.id}
              href={`/employee/requests/${request.id}`}
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
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "20px",
                  }}
                >
                  <div>
                    <h2>{request.title}</h2>

                    <p>
                      {request.request_number}
                    </p>

                    <p>
                      {request.purpose}
                    </p>
                  </div>

                  <div>
                    <strong>
                      {request.status}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "15px",
                  }}
                >
                  <span>
                    Priority: {request.priority}
                  </span>

                  <strong>
                    ₱
                    {Number(request.total_amount).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits: 2,
                      }
                    )}
                  </strong>
                </div>

                <p
                  style={{
                    marginTop: "10px",
                    fontSize: "14px",
                  }}
                >
                  Submitted:{" "}
                  {new Date(
                    request.submitted_at
                  ).toLocaleString()}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}