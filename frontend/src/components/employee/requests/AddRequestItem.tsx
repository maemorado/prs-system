"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Tag, TriangleAlert } from "lucide-react";
import { getCategories } from "@/src/services/categoryService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/src/lib/format";

type Category = {
  id: string;
  name: string;
  description: string | null;
};

type RequestItem = {
  category_id: string | null;
  item_name: string;
  description: string;
  quantity: number;
  estimated_unit_price: number;
};

type AddRequestItemProps = {
  onAdd: (item: RequestItem) => void;
};

export default function AddRequestItem({ onAdd }: AddRequestItemProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");

  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [estimatedUnitPrice, setEstimatedUnitPrice] = useState(0);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCategories() {
      try {
        setLoadingCategories(true);
        setError("");

        const data = await getCategories();

        setCategories(data);
      } catch (err) {
        console.error("Category error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load categories."
        );
      } finally {
        setLoadingCategories(false);
      }
    }

    loadCategories();
  }, []);

  // Preview of what this row will contribute to the request total, so the
  // quantity/price pair can be sanity-checked before adding.
  const lineTotal = useMemo(
    () => Number(quantity) * Number(estimatedUnitPrice),
    [quantity, estimatedUnitPrice]
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );

  function handleAddItem() {
    setError("");

    if (!itemName.trim()) {
      setError("Please enter an item name.");
      return;
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    if (estimatedUnitPrice < 0) {
      setError("Price cannot be negative.");
      return;
    }

    onAdd({
      category_id: categoryId || null,
      item_name: itemName.trim(),
      description: description.trim(),
      quantity,
      estimated_unit_price: estimatedUnitPrice,
    });

    setCategoryId("");
    setItemName("");
    setDescription("");
    setQuantity(1);
    setEstimatedUnitPrice(0);
  }

  // `type="button"` below is mandatory because this component is rendered
  // *inside* the page's own <form>; a nested <form> is invalid HTML and a
  // submit-typed button would submit the whole request. Enter-to-add is wired up
  // here instead so the single-line fields stay keyboard friendly, while the
  // textarea keeps its natural newline behaviour.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }

    event.preventDefault();
    handleAddItem();
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" />
            Request Item
          </CardTitle>

          <CardDescription>
            Describe a single item, then add it to the request. Press Enter in
            any single-line field to add the item.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 border-t border-border pt-4">
          {error && (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-sm font-medium text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-12">
            {/* Item name spans the widest column because it is the field people
                scan for first. */}
            <div className="space-y-2 lg:col-span-5">
              <Label htmlFor="item-name">
                Item Name
                <span className="text-destructive">*</span>
              </Label>

              <Input
                id="item-name"
                type="text"
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="e.g. A4 Bond Paper"
                aria-required="true"
                aria-invalid={Boolean(error) && !itemName.trim()}
              />
            </div>

            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="category">Category</Label>

              <NativeSelect
                id="category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={loadingCategories}
                className="w-full"
              >
                <option value="">
                  {loadingCategories
                    ? "Loading categories..."
                    : categories.length === 0
                      ? "No categories available"
                      : "Select category (optional)"}
                </option>

                {categories.map((category) => (
                  <NativeSelectOption
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="quantity">
                Quantity
                <span className="text-destructive">*</span>
              </Label>

              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                aria-required="true"
                className="tabular-nums"
              />
            </div>

            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="unit-price">
                Estimated Unit Price
                <span className="text-destructive">*</span>
              </Label>

              <div className="relative">
                <Input
                  id="unit-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={estimatedUnitPrice}
                  onChange={(event) =>
                    setEstimatedUnitPrice(Number(event.target.value))
                  }
                  aria-required="true"
                  className="pr-12 tabular-nums"
                />

                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
                >
                  ₱
                </span>
              </div>
            </div>

            {/* Line total is read-only output, not an input. */}
            <div className="space-y-2 lg:col-span-3">
              <span className="text-sm font-medium">Line Total</span>

              <div
                aria-live="polite"
                className="flex h-8 items-center rounded-lg border border-dashed border-border bg-muted/40 px-2.5 text-sm font-semibold text-foreground tabular-nums"
              >
                {formatAmount(lineTotal)}
              </div>

              <p className="text-xs text-muted-foreground">
                {quantity} × {formatAmount(estimatedUnitPrice)}
              </p>
            </div>

            <div className="space-y-2 lg:col-span-5">
              <Label htmlFor="item-description">Description</Label>

              <Textarea
                id="item-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional: specs, size, brand, or why it is needed..."
                rows={2}
                className="resize-y"
              />

              {selectedCategory?.description && (
                <p className="text-xs text-muted-foreground">
                  {selectedCategory.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button type="button" onClick={handleAddItem}>
              <Plus className="size-4" />
              Add Item
            </Button>
          </div>

          {loadingCategories && (
            <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading categories...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}