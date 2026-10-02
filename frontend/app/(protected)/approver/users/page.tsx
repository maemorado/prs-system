"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import { friendlyError } from "@/src/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  Check,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { StatCard } from "@/src/components/shared/stat-card";
import { capitalize, formatDate } from "@/src/lib/format";

type UserProfile = {
  id: string;
  full_name: string;
  employee_id: string | null;
  role: string;
  department_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type Department = {
  id: string;
  name: string;
};

/**
 * Roles that exist in the `profiles.role` column. Read from the data rather
 * than treated as a fixed business list, so a new role added in the database is
 * still selectable without a code change, and no invented role can be offered.
 */
function roleOptionsFrom(users: UserProfile[]) {
  const roles = new Set<string>();

  for (const user of users) {
    roles.add(user.role);
  }

  return [...roles].sort();
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "approver":
      return "secondary" as const;

    case "employee":
      return "outline" as const;

    default:
      return "default" as const;
  }
}

export default function ApproverUsersPage() {
  const { profile: currentProfile } = useProfile();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // The row currently open in the manage dialog.
  const [editing, setEditing] = useState<UserProfile | null>(null);

  const [editFullName, setEditFullName] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    // Note: every `setState` below sits after an `await`. Setting state
    // synchronously here would make this effect cascade a second render before
    // the request even starts.
    try {
      const supabase = createClient();

      const [usersResult, departmentsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            employee_id,
            role,
            department_id,
            created_at,
            updated_at
          `
          )
          .order("full_name", {
            ascending: true,
          }),

        supabase
          .from("departments")
          .select("id, name")
          .order("name", {
            ascending: true,
          }),
      ]);

      if (usersResult.error) {
        console.error("Users error:", usersResult.error);

        setError(usersResult.error.message);
        return;
      }

      if (departmentsResult.error) {
        console.error("Departments error:", departmentsResult.error);

        setError(departmentsResult.error.message);
        return;
      }

      setUsers(usersResult.data ?? []);
      setDepartments(departmentsResult.data ?? []);
      setError("");
    } catch (err) {
      console.error("User management load error:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load: fetch the user list once when the page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  function handleRetry() {
    setLoading(true);
    void loadUsers();
  }

  const roleOptions = useMemo(() => roleOptionsFrom(users), [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        user.full_name.toLowerCase().includes(term) ||
        (user.employee_id ?? "").toLowerCase().includes(term)
      );
    });
  }, [users, search, roleFilter]);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const department of departments) {
      map.set(department.id, department.name);
    }

    return map;
  }, [departments]);

  function getDepartmentName(departmentId: string | null) {
    if (!departmentId) {
      return "Not assigned";
    }

    return departmentNameById.get(departmentId) ?? "Unknown department";
  }

  const counts = useMemo(
    () => ({
      total: users.length,
      approvers: users.filter((user) => user.role === "approver")
        .length,
      unassigned: users.filter((user) => !user.department_id).length,
    }),
    [users]
  );

  function openManageDialog(user: UserProfile) {
    setEditing(user);
    setEditFullName(user.full_name);
    setEditEmployeeId(user.employee_id ?? "");
    setEditRole(user.role);
    setEditDepartmentId(user.department_id ?? "");
    setSaveError("");
    setSaveSuccess("");
  }

  async function handleSaveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing || saving) {
      return;
    }

    setSaveError("");
    setSaveSuccess("");

    const fullName = editFullName.trim();

    if (!fullName) {
      setSaveError("Full name is required.");
      return;
    }

    // Guard against an approver removing their own approver access, which
    // would lock them (and potentially everyone) out of this page.
    if (
      editing.id === currentProfile?.id &&
      editRole !== editing.role
    ) {
      setSaveError(
        "You cannot change your own role. Ask another approver to do it."
      );
      return;
    }

    setSaving(true);

    const supabase = createClient();

    // Scoped to the target row so this can never touch another user by
    // accident. Row Level Security remains the real authority: the `select`
    // below lets us detect a silently-rejected write instead of reporting a
    // success that never happened.
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        employee_id: editEmployeeId.trim() || null,
        role: editRole,
        department_id: editDepartmentId || null,
      })
      .eq("id", editing.id)
      .select(
        `
        id,
        full_name,
        employee_id,
        role,
        department_id,
        created_at,
        updated_at
      `
      )
      .maybeSingle();

    if (updateError) {
      console.error("User update error:", updateError);

      setSaveError(
        friendlyError(
          updateError,
          "Unable to update this user. Please try again."
        )
      );

      setSaving(false);
      return;
    }

    if (!updated) {
      setSaveError(
        "Nothing was saved. Your role is probably not permitted to change these fields for this user."
      );

      setSaving(false);
      return;
    }

    // Replace the row from what the database actually stored, so the table never
    // shows an optimistic value that was rejected or normalised server-side.
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user))
    );

    setEditing(updated);
    setSaving(false);
    setSaveSuccess(`${updated.full_name}'s account has been updated.`);
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="User Management" />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title="User Management"
        description="View every account, and manage roles and department assignments."
      >
        <Button
          variant="ghost"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Dashboard
        </Button>
      </PageHeader>

      {error && (
        <ErrorState message={error} onRetry={handleRetry} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Users"
          value={counts.total}
          icon={Users}
          tone="primary"
        />

        <StatCard
          label="Approvers"
          value={counts.approvers}
          icon={ShieldCheck}
          tone="approved"
        />

        <StatCard
          label="Awaiting Department"
          value={counts.unassigned}
          icon={Building2}
          tone={counts.unassigned > 0 ? "pending" : "default"}
        />
      </div>

      {/*
        Capabilities that Supabase's Admin API owns. They need the service_role
        key, which must never ship to a browser, so they are called out instead
        of being faked with client-side writes.
      */}
      <Alert>
        <Info className="size-4" />
        <AlertTitle>Managed by your Supabase admin</AlertTitle>
        <AlertDescription>
          Creating sign-in accounts, editing other users&rsquo; email
          addresses, and activating or deactivating accounts are all
          Supabase Auth admin operations. They require the service&nbsp;role
          key, which is deliberately not exposed to this browser app. Everything
          that lives in the <code>profiles</code> table &mdash; name,
          employee ID, role and department &mdash; is managed below.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-muted-foreground" />
            Accounts
          </CardTitle>

          <CardDescription>
            Select <strong>Manage</strong> to change a user&rsquo;s role or
            department assignment.
          </CardDescription>

          <CardAction>
            <Badge variant="secondary" className="tabular-nums">
              {filteredUsers.length} of {users.length}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />

              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or employee ID..."
                aria-label="Search users"
                className="pl-8"
              />
            </div>

            <NativeSelect
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Filter by role"
              className="w-full sm:w-48"
            >
              <NativeSelectOption value="all">
                All roles
              </NativeSelectOption>

              {roleOptions.map((role) => (
                <NativeSelectOption key={role} value={role}>
                  {capitalize(role)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                users.length === 0
                  ? "No users found"
                  : "No matching users"
              }
              description={
                users.length === 0
                  ? "There are currently no users in the system."
                  : "Try a different search term or clear the role filter."
              }
              action={
                users.length === 0 ? undefined : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Desktop / tablet: a real table. */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium break-words whitespace-normal text-foreground">
                          {user.full_name}

                          {user.id === currentProfile?.id && (
                            <Badge
                              variant="ghost"
                              className="ml-2 align-middle"
                            >
                              You
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-muted-foreground tabular-nums">
                          {user.employee_id || "—"}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={getRoleBadgeVariant(
                              user.role
                            )}
                          >
                            {capitalize(user.role)}
                          </Badge>
                        </TableCell>

                        <TableCell className="whitespace-normal">
                          {user.department_id ? (
                            <span className="text-foreground">
                              {getDepartmentName(
                                user.department_id
                              )}
                            </span>
                          ) : (
                            <Badge
                              variant="outline"
                              className="font-normal text-muted-foreground"
                            >
                              Not assigned
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openManageDialog(user)
                            }
                          >
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards, so nothing is clipped and there is no
                  horizontal scrolling. */}
              <ul className="space-y-3 md:hidden">
                {filteredUsers.map((user) => (
                  <li
                    key={user.id}
                    className="space-y-2.5 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold break-words text-foreground">
                          {user.full_name}
                        </p>

                        <p className="text-xs text-muted-foreground tabular-nums">
                          {user.employee_id || "No employee ID"}
                        </p>
                      </div>

                      <Badge
                        variant={getRoleBadgeVariant(user.role)}
                        className="shrink-0"
                      >
                        {capitalize(user.role)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Department:
                      </span>

                      <span className="font-medium text-foreground">
                        {getDepartmentName(user.department_id)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
                      <span className="text-xs text-muted-foreground">
                        Registered{" "}
                        {formatDate(user.created_at)}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openManageDialog(user)}
                      >
                        Manage
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveUser}>
            <DialogHeader>
              <DialogTitle>Manage account</DialogTitle>

              <DialogDescription>
                {editing
                  ? `Update ${editing.full_name}'s profile, role and department assignment.`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {saveSuccess && (
                <Alert>
                  <Check className="size-4" />
                  <AlertTitle>Saved</AlertTitle>
                  <AlertDescription>
                    {saveSuccess}
                  </AlertDescription>
                </Alert>
              )}

              {saveError && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Unable to save</AlertTitle>
                  <AlertDescription>
                    {saveError}
                  </AlertDescription>
                </Alert>
              )}

              <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2">
                <dt className="text-muted-foreground">Account ID</dt>
                <dd className="truncate font-mono text-foreground">
                  {editing?.id}
                </dd>

                <dt className="text-muted-foreground">Registered</dt>
                <dd className="text-foreground">
                  {editing ? formatDate(editing.created_at) : ""}
                </dd>

                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="text-foreground">
                  {editing?.updated_at
                    ? formatDate(editing.updated_at)
                    : "Never"}
                </dd>

                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-foreground">
                  Not visible to this app
                </dd>
              </dl>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="manage-full-name">
                    Full Name
                  </Label>

                  <Input
                    id="manage-full-name"
                    value={editFullName}
                    onChange={(event) =>
                      setEditFullName(event.target.value)
                    }
                    placeholder="e.g. Juan Dela Cruz"
                    autoComplete="name"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manage-employee-id">
                    Employee ID
                  </Label>

                  <Input
                    id="manage-employee-id"
                    value={editEmployeeId}
                    onChange={(event) =>
                      setEditEmployeeId(event.target.value)
                    }
                    placeholder="e.g. EMP-0001"
                    autoComplete="off"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manage-role">Role</Label>

                  <NativeSelect
                    id="manage-role"
                    value={editRole}
                    onChange={(event) =>
                      setEditRole(event.target.value)
                    }
                    disabled={
                      saving ||
                      editing?.id === currentProfile?.id
                    }
                    className="w-full"
                  >
                    {roleOptions.map((role) => (
                      <NativeSelectOption
                        key={role}
                        value={role}
                      >
                        {capitalize(role)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>

                  {editing?.id === currentProfile?.id && (
                    <p className="text-xs text-muted-foreground">
                      You cannot change your own role.
                    </p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="manage-department">
                    Department
                  </Label>

                  <NativeSelect
                    id="manage-department"
                    value={editDepartmentId}
                    onChange={(event) =>
                      setEditDepartmentId(event.target.value)
                    }
                    disabled={saving}
                    className="w-full"
                  >
                    <NativeSelectOption value="">
                      Not assigned
                    </NativeSelectOption>

                    {departments.map((department) => (
                      <NativeSelectOption
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>

                  <p className="text-xs text-muted-foreground">
                    Assigning a department here is how an employee gets their
                    department. Employees cannot set this themselves.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Close
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}