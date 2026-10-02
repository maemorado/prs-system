"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { Building2, ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Department = {
  id: string;
  name: string;
  created_at: string;
};

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<
    Department[]
  >([]);

  const [name, setName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadDepartments() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("departments")
      .select("id, name, created_at")
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Departments error:",
        error
      );

      setError(error.message);
      return;
    }

    setDepartments(data ?? []);
  }

  useEffect(() => {
    async function load() {
      await loadDepartments();
      setLoading(false);
    }

    load();
  }, []);

  async function handleAddDepartment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter a department name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const supabase = createClient();

    const { error } = await supabase
      .from("departments")
      .insert({
        name: trimmedName,
      });

    if (error) {
      console.error(
        "Add department error:",
        error
      );

      setError(error.message);
      setSaving(false);
      return;
    }

    setName("");

    await loadDepartments();

    setSuccess(
      "Department added successfully."
    );

    setSaving(false);
  }

  async function handleDeleteDepartment(
    department: Department
  ) {
    const confirmed = window.confirm(
      `Delete "${department.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    const supabase = createClient();

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", department.id);

    if (error) {
      console.error(
        "Delete department error:",
        error
      );

      setError(
        "Unable to delete this department. It may already be assigned to a user."
      );

      return;
    }

    await loadDepartments();

    setSuccess(
      "Department deleted successfully."
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Departments" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Header */}
      <PageHeader
        title="Departments"
        description="Manage departments used by the purchase request system."
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
        <div className="flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Add Department */}
      <Card>
        <CardHeader>
          <CardTitle>Add Department</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleAddDepartment}
            className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="w-full space-y-2">
              <Label htmlFor="department-name">
                Department Name
              </Label>

              <Input
                id="department-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Department name"
                disabled={saving}
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="sm:shrink-0"
            >
              {saving ? "Adding..." : "Add Department"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Department List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Departments ({departments.length})
          </h2>
        </div>

        {departments.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No departments yet"
            description="No departments have been created yet."
          />
        ) : (
          <Card>
            <CardContent className="pt-(--card-spacing)">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {departments.map(
                    (department) => (
                      <TableRow key={department.id}>
                        <TableCell className="font-medium text-foreground">
                          {department.name}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {formatDate(department.created_at)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              handleDeleteDepartment(
                                department
                              )
                            }
                            aria-label={`Delete ${department.name}`}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
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