"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, createEphemeralAuthClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import { friendlyError } from "@/src/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/src/components/shared/state";
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

const PROFILE_COLUMNS = `
  id,
  full_name,
  employee_id,
  role,
  department_id,
  created_at,
  updated_at
`;

/** Matches the minimum already enforced on the profile password form. */
const MIN_PASSWORD_LENGTH = 8;

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Roles are read from the rows already loaded rather than hardcoded, so a role
 * added to the database is offered automatically and no invented role can be
 * selected.
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

function RevealPasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      title={visible ? "Hide password" : "Show password"}
      className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {visible ? (
        <EyeOff className="size-4" />
      ) : (
        <Eye className="size-4" />
      )}
    </button>
  );
}

export default function ApproverUsersPage() {
  const { profile: currentProfile } = useProfile();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  /** Banner shown after an account is created. */
  const [createdNotice, setCreatedNotice] = useState<{
    name: string;
    email: string;
    needsConfirmation: boolean;
  } | null>(null);

  // ---------------------------------------------------------------------
  // Manage account dialog
  // ---------------------------------------------------------------------
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // ---------------------------------------------------------------------
  // Create account dialog
  // ---------------------------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadUsers = useCallback(async () => {
    // Note: every `setState` below sits after an `await`. Setting state
    // synchronously here would make the mount effect cascade a second render
    // before the request even starts.
    try {
      const supabase = createClient();

      const [usersResult, departmentsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .order("full_name", { ascending: true }),

        supabase
          .from("departments")
          .select("id, name")
          .order("name", { ascending: true }),
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

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const department of departments) {
      map.set(department.id, department.name);
    }

    return map;
  }, [departments]);

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

  const counts = useMemo(
    () => ({
      total: users.length,
      approvers: users.filter((user) => user.role === "approver")
        .length,
      unassigned: users.filter((user) => !user.department_id).length,
    }),
    [users]
  );

  function getDepartmentName(departmentId: string | null) {
    if (!departmentId) {
      return "Not assigned";
    }

    return departmentNameById.get(departmentId) ?? "Unknown department";
  }

  function resetCreateForm() {
    setNewFullName("");
    setNewEmail("");
    setNewEmployeeId("");
    setNewRole("");
    setNewDepartmentId("");
    setNewPassword("");
    setNewConfirmPassword("");
    setShowPassword(false);
    setCreateError("");
  }

  function openCreateDialog() {
    resetCreateForm();

    // Default to the most common role so the common case is one click.
    setNewRole(roleOptions.includes("employee") ? "employee" : "");

    setCreateOpen(true);
  }

  function openManageDialog(user: UserProfile) {
    setEditing(user);
    setEditFullName(user.full_name);
    setEditEmployeeId(user.employee_id ?? "");
    setEditRole(user.role);
    setEditDepartmentId(user.department_id ?? "");
    setSaveError("");
    setSaveSuccess("");
  }

  // =====================================================================
  // Update an existing account
  // =====================================================================
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
    // would lock them out of this page.
    if (editing.id === currentProfile?.id && editRole !== editing.role) {
      setSaveError(
        "You cannot change your own role. Ask another approver to do it."
      );
      return;
    }

    setSaving(true);

    const supabase = createClient();

    // Scoped to the target row so this can never touch another account by
    // accident. Access rules remain the real authority: the `select` below lets
    // us detect a rejected write instead of reporting a success that never
    // happened.
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        employee_id: editEmployeeId.trim() || null,
        role: editRole,
        department_id: editDepartmentId || null,
      })
      .eq("id", editing.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (updateError) {
      console.error("User update error:", updateError);

      setSaveError(
        friendlyError(
          updateError,
          "Unable to update this account. Please try again."
        )
      );

      setSaving(false);
      return;
    }

    if (!updated) {
      setSaveError(
        "Nothing was saved. Your role is probably not permitted to change these details for this account."
      );

      setSaving(false);
      return;
    }

    // Replace the row from what was actually stored, so the table never shows
    // an optimistic value that was rejected or adjusted.
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user))
    );

    setEditing(updated);
    setSaving(false);
    setSaveSuccess(`${updated.full_name}'s account has been updated.`);
  }

  // =====================================================================
  // Create a new account
  // =====================================================================
  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    setCreateError("");

    const fullName = newFullName.trim();
    const email = newEmail.trim();
    const password = newPassword;

    if (!fullName) {
      setCreateError("Full name is required.");
      return;
    }

    if (!email) {
      setCreateError("Email address is required.");
      return;
    }

    // Deliberately loose: the authoritative check is the response from the
    // account service, which gives a far clearer message than a regex would.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError("Enter a valid email address.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setCreateError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      );
      return;
    }

    if (password !== newConfirmPassword) {
      setCreateError("Password and confirmation do not match.");
      return;
    }

    setCreating(true);

    // A throwaway client, so creating an account never disturbs the approver's
    // own signed-in session.
    const auth = createEphemeralAuthClient();

    const { data, error: signUpError } = await auth.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      console.error("Account creation error:", signUpError);

      setCreateError(
        friendlyError(
          signUpError,
          "Unable to create this account. Please try again."
        )
      );

      setCreating(false);
      return;
    }

    const newUserId = data.user?.id;

    if (!newUserId) {
      setCreateError(
        "The account could not be created. Please try again."
      );

      setCreating(false);
      return;
    }

    // Attach the account details to a user record. Updating first and only
    // inserting when nothing came back means this works whether or not the
    // account was already given a record automatically, without failing on a
    // duplicate.
    const supabase = createClient();

    const details = {
      full_name: fullName,
      employee_id: newEmployeeId.trim() || null,
      role: newRole,
      department_id: newDepartmentId || null,
    };

    const { data: linked, error: linkError } = await supabase
      .from("profiles")
      .update(details)
      .eq("id", newUserId)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (linkError) {
      console.error("Account details error:", linkError);

      setCreateError(
        friendlyError(
          linkError,
          "The sign-in was created but its details could not be saved. Please try again."
        )
      );

      setCreating(false);
      return;
    }

    if (!linked) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: newUserId, ...details });

      if (insertError) {
        console.error("Account record error:", insertError);

        setCreateError(
          friendlyError(
            insertError,
            "The sign-in was created but its details could not be saved. Please contact an administrator."
          )
        );

        setCreating(false);
        return;
      }
    }

    // `session` is only returned when the account is able to sign in straight
    // away. Without it the person has to confirm their email address first.
    const needsConfirmation = data.session === null;

    setCreating(false);
    setCreateOpen(false);
    resetCreateForm();

    setCreatedNotice({ name: fullName, email, needsConfirmation });

    // Refresh so the new account appears on its own, with no manual reload.
    await loadUsers();
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
        description="Create accounts, assign departments, and manage access."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            render={<Link href="/approver/dashboard" />}
          >
            <ArrowLeft />
            Back to Dashboard
          </Button>

          <Button onClick={openCreateDialog}>
            <UserPlus className="size-4" />
            Create Account
          </Button>
        </div>
      </PageHeader>

      {createdNotice && (
        <Alert>
          <Check className="size-4" />
          <AlertTitle>Account created</AlertTitle>
          <AlertDescription>
            <span className="block">
              {createdNotice.name} can now sign in with{" "}
              <span className="font-medium break-all text-foreground">
                {createdNotice.email}
              </span>
              .
            </span>

            {createdNotice.needsConfirmation && (
              <span className="mt-1 block">
                They will need to confirm their email address before their
                first sign-in.
              </span>
            )}
          </AlertDescription>

          <AlertAction>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCreatedNotice(null)}
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </Button>
          </AlertAction>
        </Alert>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-muted-foreground" />
            Accounts
          </CardTitle>

          <CardDescription>
            Select the edit action on an account to change its role or
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
                aria-label="Search accounts"
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
                  ? "No accounts yet"
                  : "No matching accounts"
              }
              description={
                users.length === 0
                  ? "Create the first account to get started."
                  : "Try a different search term or clear the role filter."
              }
              action={
                users.length === 0 ? (
                  <Button onClick={openCreateDialog}>
                    <UserPlus className="size-4" />
                    Create Account
                  </Button>
                ) : (
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
              {/* Tablet and desktop: a real table. */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="w-px text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="whitespace-normal">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] font-semibold">
                                {initialsOf(user.full_name)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              <p className="font-medium break-words text-foreground">
                                {user.full_name}

                                {user.id === currentProfile?.id && (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    (you)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-muted-foreground tabular-nums">
                          {user.employee_id || "—"}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={getRoleBadgeVariant(user.role)}
                          >
                            {capitalize(user.role)}
                          </Badge>
                        </TableCell>

                        <TableCell className="whitespace-normal">
                          {user.department_id ? (
                            <span className="text-foreground">
                              {getDepartmentName(user.department_id)}
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

                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDate(user.created_at)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openManageDialog(user)}
                            aria-label={`Edit ${user.full_name}`}
                            title={`Edit ${user.full_name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked rows, so nothing is clipped and there is no
                  horizontal scrolling. */}
              <ul className="space-y-3 md:hidden">
                {filteredUsers.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px] font-semibold">
                        {initialsOf(user.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-sm font-medium break-words text-foreground">
                        {user.full_name}
                        {user.id === currentProfile?.id && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={getRoleBadgeVariant(user.role)}
                        >
                          {capitalize(user.role)}
                        </Badge>

                        <Badge
                          variant="outline"
                          className="font-normal"
                        >
                          {getDepartmentName(user.department_id)}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground tabular-nums">
                        {user.employee_id
                          ? `${user.employee_id} · `
                          : ""}
                        Joined {formatDate(user.created_at)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openManageDialog(user)}
                      aria-label={`Edit ${user.full_name}`}
                      title={`Edit ${user.full_name}`}
                      className="shrink-0"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* -----------------------------------------------------------------
          Create Account
      ----------------------------------------------------------------- */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && !creating) {
            setCreateOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle>Create Account</DialogTitle>

              <DialogDescription>
                Set up sign-in access and assign the account to a role and
                department.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {createError && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Unable to create account</AlertTitle>
                  <AlertDescription>
                    {createError}
                  </AlertDescription>
                </Alert>
              )}

              <section className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Account Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-full-name">
                      Full Name
                      <span className="text-destructive">*</span>
                    </Label>

                    <Input
                      id="new-full-name"
                      value={newFullName}
                      onChange={(event) =>
                        setNewFullName(event.target.value)
                      }
                      placeholder="e.g. Juan Dela Cruz"
                      autoComplete="off"
                      required
                      disabled={creating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-email">
                      Email Address
                      <span className="text-destructive">*</span>
                    </Label>

                    <Input
                      id="new-email"
                      type="email"
                      inputMode="email"
                      value={newEmail}
                      onChange={(event) =>
                        setNewEmail(event.target.value)
                      }
                      placeholder="name@example.com"
                      autoComplete="off"
                      required
                      disabled={creating}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="new-employee-id">
                      Employee ID
                    </Label>

                    <Input
                      id="new-employee-id"
                      value={newEmployeeId}
                      onChange={(event) =>
                        setNewEmployeeId(event.target.value)
                      }
                      placeholder="e.g. EMP-0001"
                      autoComplete="off"
                      disabled={creating}
                      className="sm:max-w-xs"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Access
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-role">
                      Role
                      <span className="text-destructive">*</span>
                    </Label>

                    <NativeSelect
                      id="new-role"
                      value={newRole}
                      onChange={(event) =>
                        setNewRole(event.target.value)
                      }
                      required
                      disabled={creating}
                      className="w-full"
                    >
                      <NativeSelectOption value="" disabled>
                        Select a role
                      </NativeSelectOption>

                      {roleOptions.map((role) => (
                        <NativeSelectOption
                          key={role}
                          value={role}
                        >
                          {capitalize(role)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-department">
                      Department
                    </Label>

                    <NativeSelect
                      id="new-department"
                      value={newDepartmentId}
                      onChange={(event) =>
                        setNewDepartmentId(event.target.value)
                      }
                      disabled={creating}
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
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Sign-In Security
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">
                      Password
                      <span className="text-destructive">*</span>
                    </Label>

                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(event.target.value)
                        }
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        autoComplete="new-password"
                        required
                        disabled={creating}
                        className="pr-9"
                      />

                      <RevealPasswordToggle
                        visible={showPassword}
                        onToggle={() =>
                          setShowPassword((value) => !value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-confirm-password">
                      Confirm Password
                      <span className="text-destructive">*</span>
                    </Label>

                    <div className="relative">
                      <Input
                        id="new-confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={newConfirmPassword}
                        onChange={(event) =>
                          setNewConfirmPassword(event.target.value)
                        }
                        placeholder="Re-enter the password"
                        autoComplete="new-password"
                        required
                        disabled={creating}
                        className="pr-9"
                      />

                      <RevealPasswordToggle
                        visible={showPassword}
                        onToggle={() =>
                          setShowPassword((value) => !value)
                        }
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Use at least {MIN_PASSWORD_LENGTH} characters — a mix of
                      letters, numbers, and symbols.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4" />
                    Create Account
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -----------------------------------------------------------------
          Manage account
      ----------------------------------------------------------------- */}
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
              <DialogTitle>Edit Account</DialogTitle>

              <DialogDescription>
                {editing
                  ? `Update ${editing.full_name}'s details, role and department.`
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

              <dl className="grid gap-x-6 gap-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-[auto_1fr]">
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
                      saving || editing?.id === currentProfile?.id
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
                    department.
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