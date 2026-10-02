"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/src/components/shared/profile-provider";
import { PageLoader } from "@/src/components/shared/state";
import ApproverSidebar from "@/src/components/approver/layout/ApproverSidebar";

/**
 * Roles that may enter the `/approver` area, including User Management.
 *
 * These are the roles that already exist in the `profiles.role` column. This is
 * not a new authorization model — it is the same model the sidebar and login
 * redirect already assume, enforced so an employee who types the URL (or follows
 * a stale link) cannot reach an approver-only screen.
 *
 * Row Level Security remains the real authority for data access; this guard only
 * stops the approver UI from being rendered to the wrong role. Nothing here
 * weakens or replaces a policy.
 */
const APPROVER_ROLES = new Set(["approver", "admin"]);

export default function ApproverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { status, profile } = useProfile();

  // `undefined` while the profile row is still being resolved, which is not the
  // same as "resolved and not an approver".
  const role = profile?.role;
  const resolved = status === "authenticated" && role !== undefined;
  const permitted = resolved && APPROVER_ROLES.has(role);

  useEffect(() => {
    if (resolved && !APPROVER_ROLES.has(role)) {
      router.replace("/employee/dashboard");
    }
  }, [resolved, role, router]);

  // Hold the loader until both the session and the role are known, so approver
  // screens never flash for a user who is about to be redirected.
  if (!permitted) {
    return <PageLoader label="Checking your access..." />;
  }

  return <ApproverSidebar>{children}</ApproverSidebar>;
}