"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/src/components/shared/page-header";
import { CardSkeleton, ErrorState } from "@/src/components/shared/state";
import { capitalize } from "@/src/lib/format";

type Profile = {
  id: string;
  full_name: string;
  employee_id: string | null;
  role: string;
  department_id: string | null;
};

type Department = {
  id: string;
  name: string;
};

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4 sm:grid-cols-[160px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You are not authenticated.");
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            employee_id,
            role,
            department_id
          `
          )
          .eq("id", user.id)
          .single();

      if (profileError) {
        console.error("Profile error:", profileError);
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      if (profileData.department_id) {
        const { data: departmentData, error: departmentError } =
          await supabase
            .from("departments")
            .select("id, name")
            .eq("id", profileData.department_id)
            .single();

        if (departmentError) {
          console.error(
            "Department error:",
            departmentError
          );
        } else {
          setDepartment(departmentData);
        }
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader title="My Profile" />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader title="My Profile" />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader title="My Profile" />
        <ErrorState message="Profile not found." onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const initials = profile.full_name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="My Profile" description="View your employee account information." />

      <Card>
        <CardHeader className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
            {initials}
          </span>

          <div className="grid gap-1">
            <CardTitle className="text-lg">{profile.full_name}</CardTitle>
            <Badge variant="secondary" className="w-fit">
              {capitalize(profile.role)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="border-t border-border pt-4">
          <dl className="space-y-3">
            <DetailRow label="Full Name">{profile.full_name}</DetailRow>

            <DetailRow label="Email">
              {email || "No email available"}
            </DetailRow>

            <DetailRow label="Employee ID">
              {profile.employee_id || "Not assigned"}
            </DetailRow>

            <DetailRow label="Role">{capitalize(profile.role)}</DetailRow>

            <DetailRow label="Department">
              {department?.name || "Not assigned"}
            </DetailRow>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}