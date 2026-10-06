"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import { usePagination } from "@/hooks/use-pagination";
import { cn } from "cn";
import { rangeFrom, rangeTo } from "@/src/lib/pagination";
import { countProfiles } from "@/src/lib/queries";
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
import { DataPagination } from "@/src/components/shared/data-pagination";
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

/** Sentinel for the department filter, since a real id can never be this. */
const ALL_DEPARTMENTS = "all";
const UNASSIGNED_DEPARTMENT = "unassigned";

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
 * Turns what was typed into a PostgREST `ilike` pattern.
 *
 * `%` and `_` stay as the wildcards they are — that is what makes "emp" match
 * "EMP-0001" — but a comma has to become `*`. PostgREST uses the comma to
 * separate the alternatives inside an `or=(...)` filter, and a literal comma in
 * one of the values is written as `*`; without that, searching for
 * "Dela Cruz, Juan" would produce a filter the server rejects instead of
 * results.
 */
function likePattern(term: string) {
  return `%${term.replace(/,/g, "*")}%`;
}

/**
 * Roles are read from the database rather than hardcoded, so a role added to
 * `profiles` is offered automatically and no invented role can be selected.
 *
 * Only the `role` column is fetched, and a bounded number of rows, because this
 * drives a dropdown — it must not depend on which accounts happen to be on the
 * page being displayed.
 */
function roleOptionsFrom(rows: Pick<UserProfile, "role">[]) {
  const roles = new Set<string>();

  for (const user of rows) {
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

/**
 * The generic copy shown for any failure whose cause is server-side.
 *
 * The endpoint returns actionable wording when it can — a duplicate employee ID,
 * an email that is already registered — and this for everything else. Anything
 * it cannot show safely stays in the server log.
 */
const GENERIC_CREATE_ERROR = "Unable to create the account. Please try again.";

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

  // ---------------------------------------------------------------------
  // The page of accounts, loaded from the database
  // ---------------------------------------------------------------------
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /** Whole-directory counts for the summary cards, independent of the filters. */
  const [counts, setCounts] = useState({
    total: 0,
    approvers: 0,
    unassigned: 0,
  });

  // ---------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------
  /** What is in the search box, updated on every keystroke. */
  const [searchInput, setSearchInput] = useState("");
  /**
   * What the query uses. Deferred so typing stays responsive: React renders
   * this at a lower priority, so the fetch runs once the keystrokes settle
   * instead of once per character.
   */
  const search = useDeferredValue(searchInput);

  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);

  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const { page, pageSize, totalPages, goToPage, resetToFirstPage } =
    usePagination(total);

  /** Banner shown after an account is created. */
  const [createdNotice, setCreatedNotice] = useState<{
    name: string;
    email: string;
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

  /**
   * Departments, the selectable roles and the directory-wide counts.
   *
   * Loaded once rather than per page: they are reference data for the filters
   * and the summary cards, and the counts are `head` requests, so they cost a
   * round trip each without moving a single row.
   */
  const loadLookups = useCallback(async () => {
    try {
      const supabase = createClient();

      const [departmentsResult, rolesResult, total, approvers, unassigned] =
        await Promise.all([
          supabase
            .from("departments")
            .select("id, name")
            .order("name", { ascending: true }),

          supabase.from("profiles").select("role").limit(500),

          countProfiles(supabase),
          countProfiles(supabase, "approver"),
          countProfiles(supabase, "unassigned"),
        ]);

      if (departmentsResult.error) {
        throw departmentsResult.error;
      }

      setDepartments(departmentsResult.data ?? []);
      setRoleOptions(roleOptionsFrom(rolesResult.data ?? []));
      setCounts({ total, approvers, unassigned });
    } catch (err) {
      console.error("User management lookups error:", err);

      setError(
        err instanceof Error
          ? friendlyError(err, "Failed to load accounts.")
          : "Failed to load accounts."
      );
    }
  }, []);

  /**
   * One page of accounts, filtered and counted by the database.
   *
   * The window is applied by the server (`range`), so the number of rows that
   * crosses the wire is the page size no matter how many accounts exist, and
   * `count: "exact"` is what makes "showing 11–20 of 87" possible.
   */
  const loadUsers = useCallback(async () => {
    try {
      const supabase = createClient();

      const term = search.trim();

      let query = supabase
        .from("profiles")
        .select(PROFILE_COLUMNS, { count: "exact" })
        .order("full_name", { ascending: true });

      if (term) {
        const pattern = likePattern(term);

        // One request, two searchable columns: a name *or* an employee ID.
        query = query.or(
          `full_name.ilike.${pattern},employee_id.ilike.${pattern}`
        );
      }

      if (roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }

      if (departmentFilter === UNASSIGNED_DEPARTMENT) {
        query = query.is("department_id", null);
      } else if (departmentFilter !== ALL_DEPARTMENTS) {
        query = query.eq("department_id", departmentFilter);
      }

      const { data, error: usersError, count } = await query.range(
        rangeFrom(page, pageSize),
        rangeTo(page, pageSize)
      );

      if (usersError) {
        console.error("Users error:", usersError);

        setError(
          friendlyError(usersError, "Failed to load accounts.")
        );

        return;
      }

      setUsers(data ?? []);
      setTotal(count ?? null);
      setError("");
    } catch (err) {
      console.error("User management load error:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load accounts."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, search, roleFilter, departmentFilter]);

  useEffect(() => {
    // Initial load: fetch the directory reference data once when the page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  // Only the very first load is a full-page wait. Changing a filter or a page
  // keeps the current rows on screen while the next window arrives, which stops
  // the table from collapsing and re-expanding on every click.
  const isFirstLoad = loading && total === null;

  function handleRetry() {
    setLoading(true);
    void loadLookups();
    void loadUsers();
  }

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const department of departments) {
      map.set(department.id, department.name);
    }

    return map;
  }, [departments]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    roleFilter !== "all" ||
    departmentFilter !== ALL_DEPARTMENTS;

  function clearFilters() {
    setSearchInput("");
    setRoleFilter("all");
    setDepartmentFilter(ALL_DEPARTMENTS);
    resetToFirstPage();
  }

  /**
   * Filters live on the server, so every change has to go back to page 1.
   * Otherwise page 3 of a 3-page result stays selected and the reader is shown
   * an empty table for a search that does have matches.
   */
  function handleSearchChange(value: string) {
    setSearchInput(value);
    resetToFirstPage();
  }

  function handleRoleFilterChange(value: string) {
    setRoleFilter(value);
    resetToFirstPage();
  }

  function handleDepartmentFilterChange(value: string) {
    setDepartmentFilter(value);
    resetToFirstPage();
  }

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
    // an optimistic value that was rejected or adjusted. Only the row on this
    // page is touched: the next page or filter is the database's to order.
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user))
    );

    // The edited row may now belong to a different department or role, so the
    // filtered result set is refetched rather than guessed at.
    void loadLookups();

    if (
      roleFilter !== "all" ||
      departmentFilter !== ALL_DEPARTMENTS ||
      search.trim().length > 0
    ) {
      setRefreshing(true);
      void loadUsers();
    }

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

    // The password goes to the server over this request and straight into the
    // auth server's own create call. It is never written to `profiles`, never
    // logged, and never kept in component state after the request resolves.
    //
    // Creating a sign-in and confirming its address both need a privileged key,
    // which the browser does not have. That work happens behind this endpoint.
    let response: Response;

    try {
      response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role: newRole,
          departmentId: newDepartmentId || null,
          employeeId: newEmployeeId.trim() || null,
        }),
      });
    } catch {
      setCreateError(
        "Unable to reach the server. Check your connection and try again."
      );

      setCreating(false);
      return;
    }

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      // The code is logged, never shown: it is enough to tell a validation
      // problem from a server fault without exposing anything about the server.
      console.error("Account creation error:", response.status, result?.code);

      setCreateError(
        typeof result?.error === "string" && result.error.length > 0
          ? result.error
          : GENERIC_CREATE_ERROR
      );

      setCreating(false);
      return;
    }

    setCreating(false);
    setCreateOpen(false);
    resetCreateForm();

    setCreatedNotice({ name: fullName, email });

    // The new account sorts into the directory by name, and the counts and
    // selectable departments have changed, so everything is refetched. Filters
    // are cleared and page 1 shown, which is the only place the new account is
    // guaranteed to be visible.
    clearFilters();

    await loadLookups();

    setRefreshing(true);
    await loadUsers();
  }

  if (isFirstLoad) {
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
          <AlertTitle>Account created successfully.</AlertTitle>
          <AlertDescription>
            <span className="block">
              {createdNotice.name} can sign in now with{" "}
              <span className="font-medium break-all text-foreground">
                {createdNotice.email}
              </span>
              . No email confirmation is needed.
            </span>
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
              {hasActiveFilters && total != null
                ? `${total} matching`
                : `${counts.total} total`}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent
          className="space-y-4 border-t border-border pt-4"
          aria-busy={refreshing}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />

              <Input
                type="search"
                value={searchInput}
                onChange={(event) =>
                  handleSearchChange(event.target.value)
                }
                placeholder="Search by name or employee ID..."
                aria-label="Search accounts"
                className="pl-8"
              />
            </div>

            <NativeSelect
              value={roleFilter}
              onChange={(event) =>
                handleRoleFilterChange(event.target.value)
              }
              aria-label="Filter by role"
              className="w-full sm:w-40"
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

            <NativeSelect
              value={departmentFilter}
              onChange={(event) =>
                handleDepartmentFilterChange(event.target.value)
              }
              aria-label="Filter by department"
              className="w-full sm:w-52"
            >
              <NativeSelectOption value={ALL_DEPARTMENTS}>
                All departments
              </NativeSelectOption>

              {departments.map((department) => (
                <NativeSelectOption key={department.id} value={department.id}>
                  {department.name}
                </NativeSelectOption>
              ))}

              <NativeSelectOption value={UNASSIGNED_DEPARTMENT}>
                Not assigned
              </NativeSelectOption>
            </NativeSelect>
          </div>

          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                counts.total === 0
                  ? "No accounts yet"
                  : "No matching accounts"
              }
              description={
                counts.total === 0
                  ? "Create the first account to get started."
                  : "Try a different search term, or clear the role and department filters."
              }
              action={
                counts.total === 0 ? (
                  <Button onClick={openCreateDialog}>
                    <UserPlus className="size-4" />
                    Create Account
                  </Button>
                ) : (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Tablet and desktop: a real table. */}
              <div
                className={cn(
                  "hidden md:block",
                  refreshing && "opacity-60"
                )}
              >
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
                    {users.map((user) => (
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
              <ul
                className={cn(
                  "space-y-3 md:hidden",
                  refreshing && "opacity-60"
                )}
              >
                {users.map((user) => (
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

          <DataPagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            loaded={users.length}
            onPageChange={goToPage}
            itemLabel="account"
            loading={refreshing}
            className="border-t border-border pt-4"
          />
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
                      onChange={(event) => {
                        const role = event.target.value;

                        setNewRole(role);

                        // Approvers belong to a department, and the business
                        // default is Finance. Preselect it the moment the role
                        // becomes approver and no department has been chosen,
                        // so an approver is not silently created unassigned.
                        // The server applies the same prefix match as a
                        // fallback, so this is a convenience, not the
                        // enforcement point.
                        if (role === "approver" && !newDepartmentId) {
                          const finance = departments.find(
                            (department) =>
                              department.name
                                .toLowerCase()
                                .startsWith("financ")
                          );

                          if (finance) {
                            setNewDepartmentId(finance.id);
                          }
                        }
                      }}
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
