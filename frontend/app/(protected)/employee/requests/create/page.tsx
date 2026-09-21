"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import AddRequestItem from "@/src/components/requests/AddRequestItem";

type RequestItem = {
  category_id: string | null;
  item_name: string;
  description: string;
  quantity: number;
  estimated_unit_price: number;
};

export default function CreateRequestPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [priority, setPriority] = useState("normal");

  const [items, setItems] = useState<RequestItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Calculate total amount
  const totalAmount = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total + item.quantity * item.estimated_unit_price,
      0
    );
  }, [items]);

  // Add item to the list
  function handleAddItem(item: RequestItem) {
    setItems((current) => [...current, item]);
  }

  // Remove item from the list
  function handleRemoveItem(index: number) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  // Submit purchase request
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    // Validate items
    if (items.length === 0) {
      setError("Please add at least one item.");
      return;
    }

    // Validate title
    if (!title.trim()) {
      setError("Please enter a request title.");
      return;
    }

    // Validate purpose
    if (!purpose.trim()) {
      setError("Please enter the purpose of the request.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Get currently logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.push("/auth/login");
        return;
      }

      // -----------------------------------------
      // 1. CREATE PURCHASE REQUEST
      // -----------------------------------------

      const { data: request, error: requestError } =
        await supabase
          .from("purchase_requests")
          .insert({
            requested_by: user.id,
            title: title.trim(),
            purpose: purpose.trim(),
            priority,
            total_amount: totalAmount,
          })
          .select()
          .single();

      if (requestError) {
        throw requestError;
      }

      if (!request) {
        throw new Error(
          "Purchase request was not created."
        );
      }

      // -----------------------------------------
      // 2. CREATE PURCHASE REQUEST ITEMS
      // -----------------------------------------

      const requestItems = items.map((item) => ({
        request_id: request.id,
        category_id: item.category_id,
        item_name: item.item_name.trim(),
        description: item.description?.trim() || null,
        quantity: item.quantity,
        estimated_unit_price: item.estimated_unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_request_items")
        .insert(requestItems);

      if (itemsError) {
        throw itemsError;
      }

      // -----------------------------------------
      // 3. REDIRECT TO REQUEST DETAILS
      // -----------------------------------------

      router.push(`/requests/${request.id}`);
      router.refresh();
    } catch (err) {
      console.error(
        "Create purchase request error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create purchase request."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Create Purchase Request</h1>

      <p>
        Create a new procurement request.
      </p>

      {/* 
        IMPORTANT:
        There is only ONE form on this page.
      */}
      <form onSubmit={handleSubmit}>
        {/* =========================================
            REQUEST INFORMATION
        ========================================== */}

        <section>
          <h2>Request Information</h2>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="title"
              style={{
                display: "block",
                marginBottom: 5,
              }}
            >
              Request Title
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. Computer Laboratory Equipment"
              required
              style={{
                width: "100%",
                maxWidth: 600,
                padding: 10,
              }}
            />
          </div>

          {/* Purpose */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="purpose"
              style={{
                display: "block",
                marginBottom: 5,
              }}
            >
              Purpose
            </label>

            <textarea
              id="purpose"
              value={purpose}
              onChange={(event) =>
                setPurpose(event.target.value)
              }
              placeholder="Explain the purpose of this purchase..."
              required
              rows={5}
              style={{
                width: "100%",
                maxWidth: 600,
                padding: 10,
              }}
            />
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="priority"
              style={{
                display: "block",
                marginBottom: 5,
              }}
            >
              Priority
            </label>

            <select
              id="priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value)
              }
              style={{
                padding: 10,
              }}
            >
              <option value="low">
                Low
              </option>

              <option value="normal">
                Normal
              </option>

              <option value="high">
                High
              </option>

              <option value="urgent">
                Urgent
              </option>
            </select>
          </div>
        </section>

        {/* =========================================
            ADD ITEM
        ========================================== */}

        <section style={{ marginTop: 40 }}>
          <AddRequestItem
            onAdd={handleAddItem}
          />
        </section>

        {/* =========================================
            ITEMS LIST
        ========================================== */}

        <section style={{ marginTop: 30 }}>
          <h2>Items</h2>

          {items.length === 0 ? (
            <p>
              No items added yet.
            </p>
          ) : (
            <div>
              {items.map((item, index) => {
                const itemTotal =
                  item.quantity *
                  item.estimated_unit_price;

                return (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: 15,
                      marginBottom: 10,
                      maxWidth: 700,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <strong>
                          {item.item_name}
                        </strong>

                        {item.description && (
                          <p>
                            {item.description}
                          </p>
                        )}

                        <p>
                          Quantity:{" "}
                          {item.quantity}
                        </p>

                        <p>
                          Unit Price: ₱
                          {item.estimated_unit_price.toLocaleString(
                            "en-PH",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>

                        <p>
                          Subtotal: ₱
                          {itemTotal.toLocaleString(
                            "en-PH",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveItem(index)
                        }
                        style={{
                          color: "red",
                          padding: "6px 10px",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* =========================================
            TOTAL
        ========================================== */}

        <section
          style={{
            marginTop: 30,
            padding: 20,
            background: "#f5f5f5",
            maxWidth: 700,
          }}
        >
          <h2>
            Total: ₱
            {totalAmount.toLocaleString(
              "en-PH",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </h2>
        </section>

        {/* =========================================
            ERROR
        ========================================== */}

        {error && (
          <div
            style={{
              marginTop: 20,
              padding: 15,
              color: "#b91c1c",
              background: "#fee2e2",
              borderRadius: 6,
              maxWidth: 700,
            }}
          >
            {error}
          </div>
        )}

        {/* =========================================
            SUBMIT
        ========================================== */}

        <section style={{ marginTop: 30 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 20px",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Creating Request..."
              : "Create Purchase Request"}
          </button>
        </section>
      </form>
    </main>
  );
}
