"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
        setError(requestError.message);
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
        setError(itemError.message);
        setLoading(false);
        return;
      }

      setRequest(requestData);
      setItems(itemData ?? []);
      setLoading(false);
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

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadRequest]);

  if (loading) {
    return <p>Loading request...</p>;
  }

  if (error) {
    return (
      <div>
        <h1>Request Details</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!request) {
    return <p>Request not found.</p>;
  }

  return (
    <div style={{ padding: "24px" }}>
      <h1>Request Details</h1>

      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "10px",
        }}
      >
        <h2>{request.title}</h2>

        <p>
          <strong>Request Number:</strong> {request.request_number}
        </p>

        <p>
          <strong>Purpose:</strong> {request.purpose}
        </p>

        <p>
          <strong>Priority:</strong> {request.priority}
        </p>

        <p>
          <strong>Status:</strong> {request.status}
        </p>

        <p>
          <strong>Submitted:</strong>{" "}
          {new Date(request.submitted_at).toLocaleString()}
        </p>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h2>Requested Items</h2>

        {items.length === 0 ? (
          <p>No items found.</p>
        ) : (
          <div style={{ marginTop: "15px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "16px",
                  marginBottom: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <h3>{item.item_name}</h3>

                {item.description && (
                  <p>{item.description}</p>
                )}

                <p>
                  <strong>Quantity:</strong> {item.quantity}
                </p>

                <p>
                  <strong>Unit Price:</strong>{" "}
                  ₱{Number(item.estimated_unit_price).toLocaleString(
                    "en-PH",
                    {
                      minimumFractionDigits: 2,
                    }
                  )}
                </p>

                <p>
                  <strong>Total:</strong>{" "}
                  ₱{Number(item.estimated_total).toLocaleString(
                    "en-PH",
                    {
                      minimumFractionDigits: 2,
                    }
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "10px",
        }}
      >
        <h2>
          Total Amount: ₱
          {Number(request.total_amount).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}
        </h2>
      </div>
    </div>
  );
}