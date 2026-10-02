"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { ErrorState } from "@/src/components/shared/state";
import { formatAmount } from "@/src/lib/format";
import AddRequestItem from "@/src/components/employee/requests/AddRequestItem";

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

  const totalAmount = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total +
        Number(item.quantity) * Number(item.estimated_unit_price),
      0
    );
  }, [items]);

  function handleAddItem(item: RequestItem) {
    setItems((current) => [...current, item]);
  }

  function handleRemoveItem(index: number) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");

    if (!title.trim()) {
      setError("Please enter a request title.");
      return;
    }

    if (!purpose.trim()) {
      setError("Please enter the purpose of the request.");
      return;
    }

    if (items.length === 0) {
      setError("Please add at least one item.");
      return;
    }

    const invalidItem = items.find(
      (item) =>
        !item.item_name.trim() ||
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0 ||
        !Number.isFinite(Number(item.estimated_unit_price)) ||
        Number(item.estimated_unit_price) < 0
    );

    if (invalidItem) {
      setError(
        "Please make sure all items have a valid name, quantity, and estimated unit price."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authUser) {
        router.push("/auth/login");
        return;
      }

      const authenticatedUserId = authUser.id;

      const { data: request, error: requestError } =
        await supabase
          .from("purchase_requests")
          .insert({
            requested_by: authenticatedUserId,
            title: title.trim(),
            purpose: purpose.trim(),
            priority,
            total_amount: totalAmount,
          })
          .select()
          .single();

      if (requestError) {
        console.error(
          "Purchase request insert error:",
          requestError
        );

        throw requestError;
      }

      if (!request) {
        throw new Error(
          "Purchase request was not created."
        );
      }

      const requestItems = items.map((item) => ({
        request_id: request.id,
        category_id: item.category_id,
        item_name: item.item_name.trim(),
        description:
          item.description?.trim() || null,
        quantity: Number(item.quantity),
        estimated_unit_price: Number(
          item.estimated_unit_price
        ),
      }));

      const { error: itemsError } = await supabase
        .from("purchase_request_items")
        .insert(requestItems);

      if (itemsError) {
        console.error(
          "Purchase request items insert error:",
          itemsError
        );

        const { error: cleanupError } = await supabase
          .from("purchase_requests")
          .delete()
          .eq("id", request.id)
          .eq("requested_by", authenticatedUserId);

        if (cleanupError) {
          console.error(
            "Request cleanup error:",
            cleanupError
          );
        }

        throw itemsError;
      }

      router.push(
        `/employee/requests/${request.id}`
      );

      router.refresh();
    } catch (err) {
      console.error(
        "Create purchase request error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Failed to create purchase request."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Create Purchase Request"
        description="Fill in the request details and add the items you need."
      />

      {error && (
        <ErrorState
          message={error}
          onRetry={() => setError("")}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Request Information</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Request Title</Label>

              <Input
                id="title"
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="e.g. Computer Laboratory Equipment"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>

              <Textarea
                id="purpose"
                value={purpose}
                onChange={(event) =>
                  setPurpose(event.target.value)
                }
                placeholder="Explain the purpose of the request..."
                required
                disabled={loading}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>

              <NativeSelect
                id="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value)
                }
                disabled={loading}
                className="w-full sm:max-w-xs"
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
              </NativeSelect>
            </div>
          </CardContent>
        </Card>

        <AddRequestItem onAdd={handleAddItem} />

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>

            {items.length > 0 && (
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </CardAction>
            )}
          </CardHeader>

          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items added yet. Add items using the form above.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const itemTotal =
                    Number(item.quantity) *
                    Number(
                      item.estimated_unit_price
                    );

                  return (
                    <div
                      key={index}
                      className="space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {item.item_name}
                          </p>

                          {item.description && (
                            <p className="text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            handleRemoveItem(index)
                          }
                          disabled={loading}
                          aria-label={`Remove ${item.item_name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                        <span className="text-muted-foreground">
                          Quantity:{" "}
                          <span className="font-medium text-foreground">
                            {item.quantity}
                          </span>
                        </span>

                        <span className="text-muted-foreground">
                          Unit Price:{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatAmount(
                              Number(
                                item.estimated_unit_price
                              )
                            )}
                          </span>
                        </span>

                        <span className="text-muted-foreground">
                          Subtotal:{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatAmount(itemTotal)}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/40">
          <CardContent className="flex items-center justify-between py-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              Total
            </h2>

            <p className="text-xl font-bold text-foreground tabular-nums">
              {formatAmount(totalAmount)}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => router.push("/employee/requests")}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={loading}
            className="sm:min-w-48"
          >
            {loading
              ? "Creating Request..."
              : "Create Purchase Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}