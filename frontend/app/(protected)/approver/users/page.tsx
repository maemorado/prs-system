"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Users } from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { StatCard } from "@/src/components/shared/stat-card";
import { formatDate } from "@/src/lib/format";

type UserProfile = {
  id: string;
  full_name: string;
  employee_id: string | null;
  role: string;
  department_id: string | null;
  created_at: string;
};

type Department = {
  id: string;
  name: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<
    Department[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      const supabase = createClient();

      const [
        usersResult,
        departmentsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            employee_id,
            role,
            department_id,
            created_at
          `)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("departments")
          .select("id, name")
          .order("name", {
            ascending: true,
          }),
      ]);

      if (usersResult.error) {
        console.error(
          "Users error:",
          usersResult.error
        );

        setError(usersResult.error.message);
        setLoading(false);
        return;
      }

      if (departmentsResult.error) {
        console.error(
          "Departments error:",
          departmentsResult.error
        );

        setError(
          departmentsResult.error.message
        );

        setLoading(false);
        return;
      }

      setUsers(usersResult.data ?? []);
      setDepartments(
        departmentsResult.data ?? []
      );

      setLoading(false);
    }

    loadUsers();
  }, []);

  function getDepartmentName(
    departmentId: string | null
  ) {
    if (!departmentId) {
      return "No department";
    }

    const department = departments.find(
      (item) => item.id === departmentId
    );

    return department?.name ?? "Unknown";
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case "admin":
        return "Admin";

      case "approver":
        return "Approver";

      case "employee":
        return "Employee";

      default:
        return role;
    }
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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader title="Users" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <PageHeader
        title="Users"
        description="View all users registered in the system."
      >
        <Button
          variant="ghost"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Dashboard
        </Button>
      </PageHeader>

      {/* Error */}
      {error && (
        <ErrorState
          message={error}
          onRetry={() => window.location.reload()}
        />
      )}

      {/* User Count */}
      <div className="max-w-sm">
        <StatCard
          label="Total Users"
          value={users.length}
          icon={Users}
          tone="primary"
        />
      </div>

      {/* Users */}
      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Users Found"
          description="There are currently no users in the system."
        />
      ) : (
        <Card>
          <CardContent className="pt-(--card-spacing)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">
                      {user.full_name}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {user.employee_id || "—"}
                    </TableCell>

                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {getDepartmentName(user.department_id)}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}