"use client";

import { useEffect, useState } from "react";
import { getCategories } from "@/src/services/categoryService";

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

export default function AddRequestItem({
  onAdd,
}: AddRequestItemProps) {
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

        console.log("Categories from Supabase:", data);

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

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 20,
        maxWidth: 700,
      }}
    >
      <h2>Add Item</h2>

      {/* CATEGORY */}
      <div style={{ marginBottom: 15 }}>
        <label
          htmlFor="category"
          style={{
            display: "block",
            marginBottom: 5,
          }}
        >
          Category
        </label>

        <select
          id="category"
          value={categoryId}
          onChange={(event) =>
            setCategoryId(event.target.value)
          }
          disabled={loadingCategories}
          style={{
            width: "100%",
            padding: 10,
          }}
        >
          <option value="">
            {loadingCategories
              ? "Loading categories..."
              : categories.length === 0
                ? "No categories available"
                : "Select category"}
          </option>

          {categories.map((category) => (
            <option
              key={category.id}
              value={category.id}
            >
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* ITEM NAME */}
      <div style={{ marginBottom: 15 }}>
        <label
          htmlFor="item-name"
          style={{
            display: "block",
            marginBottom: 5,
          }}
        >
          Item Name
        </label>

        <input
          id="item-name"
          type="text"
          value={itemName}
          onChange={(event) =>
            setItemName(event.target.value)
          }
          placeholder="e.g. A4 Bond Paper"
          style={{
            width: "100%",
            padding: 10,
          }}
        />
      </div>

      {/* DESCRIPTION */}
      <div style={{ marginBottom: 15 }}>
        <label
          htmlFor="item-description"
          style={{
            display: "block",
            marginBottom: 5,
          }}
        >
          Description
        </label>

        <textarea
          id="item-description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          placeholder="Item description..."
          rows={3}
          style={{
            width: "100%",
            padding: 10,
          }}
        />
      </div>

      {/* QUANTITY */}
      <div style={{ marginBottom: 15 }}>
        <label
          htmlFor="quantity"
          style={{
            display: "block",
            marginBottom: 5,
          }}
        >
          Quantity
        </label>

        <input
          id="quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(event) =>
            setQuantity(Number(event.target.value))
          }
          style={{
            width: "100%",
            padding: 10,
          }}
        />
      </div>

      {/* PRICE */}
      <div style={{ marginBottom: 15 }}>
        <label
          htmlFor="unit-price"
          style={{
            display: "block",
            marginBottom: 5,
          }}
        >
          Estimated Unit Price
        </label>

        <input
          id="unit-price"
          type="number"
          min="0"
          step="0.01"
          value={estimatedUnitPrice}
          onChange={(event) =>
            setEstimatedUnitPrice(
              Number(event.target.value)
            )
          }
          style={{
            width: "100%",
            padding: 10,
          }}
        />
      </div>

      {/* ERROR */}
      {error && (
        <p
          style={{
            color: "red",
            marginBottom: 15,
          }}
        >
          {error}
        </p>
      )}

      {/* IMPORTANT: type="button" */}
      <button
        type="button"
        onClick={handleAddItem}
      >
        Add Item
      </button>
    </div>
  );
}
