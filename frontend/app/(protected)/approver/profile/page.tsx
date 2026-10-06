"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  TriangleAlert,
  UserCog,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { CardSkeleton, ErrorState } from "@/src/components/shared/state";
import { capitalize, formatDate } from "@/src/lib/format";

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
      <dd className="text-sm font-medium break-words text-foreground">
        {children}
      </dd>
    </div>
  );
}

function PasswordToggle({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

export default function ApproverProfilePage() {
  // Shared profile state: updating it here updates the sidebar and every other
  // consumer of the profile at the same time.
  const { updateProfile } = useProfile();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);

  const [editFullName, setEditFullName] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");

  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Lifted out of the mount effect so the ErrorState retry buttons can re-run
  // the same load in place (instead of a full `window.location.reload()`).
  // It clears any previous error and shows the skeleton while re-loading.
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

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
    setMemberSince(user.created_at ?? "");

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

    const { data: departmentsData, error: departmentsError } =
      await supabase
        .from("departments")
        .select("id, name")
        .order("name", { ascending: true });

    if (departmentsError) {
      console.error("Departments error:", departmentsError);
    } else {
      setDepartments(departmentsData ?? []);
    }

    setEditFullName(profileData.full_name);
    setEditEmployeeId(profileData.employee_id ?? "");
    setEditDepartmentId(profileData.department_id ?? "");

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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  const confirmMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  const newPasswordTooShort =
    newPassword.length > 0 && newPassword.length < 8;

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);

    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSubmitting(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSuccess("Your password has been updated successfully.");
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Profile" />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Profile" />
        <ErrorState
          message={error}
          onRetry={() => void loadProfile()}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Profile" />
        <ErrorState
          message="Profile not found."
          onRetry={() => void loadProfile()}
        />
      </div>
    );
  }

  const initials = profile.full_name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setEditError("");
    setEditSuccess("");

    if (!editFullName.trim()) {
      setEditError("Full name is required.");
      return;
    }

    setEditSubmitting(true);

    // Delegate the write to the shared provider. It restricts the payload to the
    // non-privileged allowlist (full_name, employee_id, department_id), scopes
    // the write to the signed-in user's own id, and treats RLS as the real
    // authority -- reporting a denied write instead of a false success. It also
    // updates shared state, so the sidebar and every other consumer of the
    // profile reflects the change immediately.
    const { error: updateError } = await updateProfile({
      full_name: editFullName,
      employee_id: editEmployeeId,
      department_id: editDepartmentId || null,
    });

    setEditSubmitting(false);

    if (updateError) {
      setEditError(updateError);
      return;
    }

    setDepartment(
      departments.find((item) => item.id === editDepartmentId) ?? null
    );

    setEditSuccess("Your profile has been updated successfully.");
  }

  const handleCancelEdit = () => {
    setEditFullName(profile.full_name);
    setEditEmployeeId(profile.employee_id ?? "");
    setEditDepartmentId(profile.department_id ?? "");
    setEditError("");
    setEditSuccess("");
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title="Profile"
        description="Your personal account information and security settings."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" />
            Profile
          </CardTitle>

          <CardDescription>
            View your approver account information.
          </CardDescription>
        </CardHeader>

        <CardContent className="border-t border-border pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar size="lg" className="size-14 sm:size-16">
              <AvatarFallback className="bg-indigo-100 text-base font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-1.5">
              <p className="text-lg font-semibold tracking-tight text-foreground">
                {profile.full_name}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {profile.employee_id ? (
                  <span className="text-sm text-muted-foreground">
                    {profile.employee_id}
                  </span>
                ) : null}

                <Badge variant="secondary">
                  {capitalize(profile.role)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator className="my-5" />

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

            <DetailRow label="Member Since">
              {formatDate(memberSince)}
            </DetailRow>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-muted-foreground" />
            Edit Profile
          </CardTitle>

          <CardDescription>
            Update your personal information.
          </CardDescription>
        </CardHeader>

        <CardContent className="border-t border-border pt-4">
          <form onSubmit={handleSaveProfile} className="max-w-3xl space-y-5">
            {editSuccess && (
              <Alert>
                <Check className="size-4" />
                <AlertTitle>Profile updated</AlertTitle>
                <AlertDescription>{editSuccess}</AlertDescription>
              </Alert>
            )}

            {editError && (
              <Alert variant="destructive">
                <TriangleAlert className="size-4" />
                <AlertTitle>Unable to update profile</AlertTitle>
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>

                <p className="rounded-lg border border-border bg-muted/40 px-2.5 py-[5px] text-sm break-words text-muted-foreground">
                  {email || "No email available"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>

                <p className="rounded-lg border border-border bg-muted/40 px-2.5 py-[5px] text-sm text-muted-foreground">
                  {capitalize(profile.role)}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full Name</Label>

              <Input
                id="edit-full-name"
                value={editFullName}
                onChange={(event) =>
                  setEditFullName(event.target.value)
                }
                placeholder="Your full name"
                autoComplete="name"
                required
                disabled={editSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-employee-id">Employee ID</Label>

              <Input
                id="edit-employee-id"
                value={editEmployeeId}
                onChange={(event) =>
                  setEditEmployeeId(event.target.value)
                }
                placeholder="e.g. EMP-0001"
                autoComplete="off"
                disabled={editSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>

              <NativeSelect
                id="edit-department"
                value={editDepartmentId}
                onChange={(event) =>
                  setEditDepartmentId(event.target.value)
                }
                disabled={editSubmitting}
                className="w-full"
              >
                <option value="">Unassigned</option>

                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={editSubmitting}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? (
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
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            Security
          </CardTitle>

          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>

        <CardContent className="border-t border-border pt-4">
          <form onSubmit={handlePasswordChange} className="max-w-xl space-y-5">
            {passwordSuccess && (
              <Alert>
                <Check className="size-4" />
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>{passwordSuccess}</AlertDescription>
              </Alert>
            )}

            {passwordError && (
              <Alert variant="destructive">
                <TriangleAlert className="size-4" />
                <AlertTitle>Unable to change password</AlertTitle>
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>

              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  className="pr-9"
                  required
                  disabled={submitting}
                />

                <PasswordToggle
                  visible={showCurrent}
                  onToggle={() => setShowCurrent((value) => !value)}
                  label={
                    showCurrent
                      ? "Hide current password"
                      : "Show current password"
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>

              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter a new password"
                  autoComplete="new-password"
                  aria-invalid={newPasswordTooShort}
                  className="pr-9"
                  disabled={submitting}
                />

                <PasswordToggle
                  visible={showNew}
                  onToggle={() => setShowNew((value) => !value)}
                  label={
                    showNew ? "Hide new password" : "Show new password"
                  }
                />
              </div>

              <p
                className={
                  newPasswordTooShort
                    ? "flex items-center gap-1 text-xs font-medium text-destructive"
                    : "flex items-center gap-1 text-xs text-muted-foreground"
                }
              >
                <TriangleAlert className="size-3 shrink-0" />
                Use at least 8 characters — a mix of letters, numbers, and
                symbols.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                Confirm New Password
              </Label>

              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  aria-invalid={confirmMismatch}
                  className="pr-9"
                  disabled={submitting}
                />

                <PasswordToggle
                  visible={showConfirm}
                  onToggle={() => setShowConfirm((value) => !value)}
                  label={
                    showConfirm
                      ? "Hide password confirmation"
                      : "Show password confirmation"
                  }
                />
              </div>

              {confirmMismatch && (
                <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <TriangleAlert className="size-3 shrink-0" />
                  Passwords do not match.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={
                submitting || confirmMismatch || newPasswordTooShort
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}