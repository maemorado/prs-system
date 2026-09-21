"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

type Request = {
  id: string;
  request_number: string;
  title: string;
  purpose: string;
  priority: string;
  status: string;
  total_amount: number;
  submitted_at: string;
};

export default function RequestDetailsPage() {
  const params = useParams();

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequest() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("purchase_requests")
        .select(
          "id, request_number, title, purpose, priority, status, total_amount, submitted_at"
        )
        .eq("id", params.id)
        .single();

      if (error) {
        console.error(error);
      }

      setRequest(data);
      setLoading(false);
    }

    loadRequest();
  }, [params.id]);

  if (loading) {
    return <p>Loading request...</p>;
  }

  if (!request) {
    return <p>Request not found.</p>;
  }

  return (
    <div>
      <h1>{request.request_number}</h1>

      <div style={{ marginTop: 30 }}>
        <h2>{request.title}</h2>

        <p>{request.purpose}</p>

        <p>
          Priority: <strong>{request.priority}</strong>
        </p>

        <p>
          Status: <strong>{request.status}</strong>
        </p>

        <p>
          Total: ₱
          {Number(request.total_amount).toLocaleString()}
        </p>
      </div>

      <hr style={{ margin: "30px 0" }} />

      <h2>Request Items</h2>

      <p>No items added yet.</p>

      <button>
        Add Item
      </button>
    </div>
  );
}