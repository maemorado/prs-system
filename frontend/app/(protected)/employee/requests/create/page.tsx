"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { friendlyError } from "@/src/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Package, Trash2 } from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState, ErrorState } from "@/src/components/shared/state";
import { formatAmount } from "@/src/lib/format";
import { getCategories } from "@/src/services/categoryService";
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

  // Category labels for the items list. The submitted payload only ever stores
  // `category_id`, so this is purely for display.
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>(
    {}
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCategoryNames() {
      try {
        const categories = await getCategories();

        if (!cancelled) {
          setCategoryNames(
            Object.fromEntries(
              categories.map((category) => [category.id, category.name])
            )
          );
        }
      } catch (err) {
        // Display-only concern: if this fails the items still list correctly,
        // they just fall back to showing the category id.
        console.error("Category label lookup error:", err);
      }
    }

    void loadCategoryNames();

    return () => {
      cancelled = true;
    };
  }, []);

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

      setError(
        friendlyError(err, "Unable to create the request. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
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

            <CardDescription>
              A short title and the reason for this request.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 border-t border-border pt-4">
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-8">
                <Label htmlFor="title">
                  Request Title
                  <span className="text-destructive">*</span>
                </Label>

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

              <div className="space-y-2 lg:col-span-4">
                <Label htmlFor="priority">Priority</Label>

                <NativeSelect
                  id="priority"
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value)
                  }
                  disabled={loading}
                  className="w-full"
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

              <div className="space-y-2 lg:col-span-12">
                <Label htmlFor="purpose">
                  Purpose
                  <span className="text-destructive">*</span>
                </Label>

                <Textarea
                  id="purpose"
                  value={purpose}
                  onChange={(event) =>
                    setPurpose(event.target.value)
                  }
                  placeholder="Explain the purpose of the request..."
                  required
                  disabled={loading}
                  rows={4}
                  className="resize-y"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <AddRequestItem onAdd={handleAddItem} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              Items
            </CardTitle>

            <CardDescription>
              Every item added above is listed here before you submit.
            </CardDescription>

            {items.length > 0 && (
              <CardAction>
                <Badge variant="secondary">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </Badge>
              </CardAction>
            )}
          </CardHeader>

          <CardContent className="border-t border-border pt-4">
            {items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No items yet"
                description="Use the Request Item section above to describe and add the things you need."
              />
            ) : (
              <ul className="space-y-2">
                {items.map((item, index) => {
                  const itemTotal =
                    Number(item.quantity) *
                    Number(
                      item.estimated_unit_price
                    );

                  const categoryLabel = item.category_id
                    ? (categoryNames[item.category_id] ??
                      "Unknown category")
                    : "Uncategorised";

                  return (
                    <li
                      key={index}
                      className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:gap-4 sm:p-4"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background text-xs font-semibold text-muted-foreground tabular-nums ring-1 ring-border"
                      >
                        {index + 1}
                      </span>

                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold break-words text-foreground">
                          {item.item_name}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge
                            variant="outline"
                            className="font-normal"
                          >
                            {categoryLabel}
                          </Badge>

                          <span className="text-xs text-muted-foreground tabular-nums">
                            {item.quantity} ×{" "}
                            {formatAmount(
                              Number(
                                item.estimated_unit_price
                              )
                            )}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-xs break-words text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatAmount(itemTotal)}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            handleRemoveItem(index)
                          }
                          disabled={loading}
                          aria-label={`Remove ${item.item_name}`}
                          title={`Remove ${item.item_name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/40">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium text-foreground">
                Request Total
              </h2>

              <p className="text-xs text-muted-foreground">
                {items.length === 0
                  ? "No items added yet"
                  : `Sum of ${items.length} item${
                      items.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>

            <p className="text-2xl font-bold text-foreground tabular-nums sm:text-3xl">
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