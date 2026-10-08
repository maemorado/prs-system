"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { friendlyError } from "@/src/lib/errors";
import { Tags, ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { formatDate } from "@/src/lib/format";

type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(
    []
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCategories() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("categories")
      .select(
        "id, name, description, created_at"
      )
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Categories error:",
        error
      );

      setError(friendlyError(error, "Failed to load categories."));
      return;
    }

    setCategories(data ?? []);
  }

  useEffect(() => {
    async function load() {
      await loadCategories();
      setLoading(false);
    }

    load();
  }, []);

  async function handleAddCategory(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescription =
      description.trim();

    if (!trimmedName) {
      setError("Please enter a category name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const supabase = createClient();

    const { error } = await supabase
      .from("categories")
      .insert({
        name: trimmedName,
        description:
          trimmedDescription || null,
      });

    if (error) {
      console.error(
        "Add category error:",
        error
      );

      setError(friendlyError(error, "Unable to add the category."));
      setSaving(false);
      return;
    }

    setName("");
    setDescription("");

    await loadCategories();

    setSuccess(
      "Category added successfully."
    );

    setSaving(false);
  }

  async function handleDeleteCategory(
    category: Category
  ) {
    const confirmed = window.confirm(
      `Delete "${category.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    const supabase = createClient();

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      console.error(
        "Delete category error:",
        error
      );

      setError(
        "Unable to delete this category. It may already be used by a purchase request."
      );

      return;
    }

    await loadCategories();

    setSuccess(
      "Category deleted successfully."
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Categories" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Header */}
      <PageHeader
        title="Categories"
        description="Manage categories available for purchase requests."
      >
        <Button
          variant="ghost"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Dashboard
        </Button>
      </PageHeader>

      {/* Messages */}
      {error && (
        <ErrorState
          message={error}
          onRetry={() => setError("")}
        />
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Add Category */}
      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleAddCategory}
            className="max-w-xl space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="category-name">
                Category Name
              </Label>

              <Input
                id="category-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Category name"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">
                Description (optional)
              </Label>

              <Textarea
                id="category-description"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Description (optional)"
                rows={3}
                disabled={saving}
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
            >
              {saving ? "Adding..." : "Add Category"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Category List */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Categories ({categories.length})
        </h2>

        {categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description="No categories have been created yet."
          />
        ) : (
          <Card>
            <CardContent className="pt-(--card-spacing)">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {categories.map(
                    (category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium text-foreground">
                          {category.name}
                        </TableCell>

                        <TableCell className="max-w-[280px] truncate text-muted-foreground">
                          {category.description || "—"}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {formatDate(category.created_at)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              handleDeleteCategory(
                                category
                              )
                            }
                            aria-label={`Delete ${category.name}`}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}