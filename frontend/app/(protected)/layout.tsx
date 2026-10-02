"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/src/components/shared/state";
import {
  ProfileProvider,
  useProfile,
} from "@/src/components/shared/profile-provider";

/**
 * The authenticated shell.
 *
 * `ProfileProvider` is the single place that resolves the session and the
 * `profiles` row, so the guard below and every consumer (sidebar, profile page,
 * dashboard) share one round trip instead of each re-fetching the same data.
 */
function GuardedContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useProfile();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return <PageLoader label="Checking your session..." />;
  }

  return <>{children}</>;
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <GuardedContent>{children}</GuardedContent>
    </ProfileProvider>
  );
}
