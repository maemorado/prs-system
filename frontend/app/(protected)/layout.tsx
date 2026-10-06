"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, PageLoader } from "@/src/components/shared/state";
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
 *
 * The four states below are handled one by one, which is what keeps "the
 * dashboard never appeared" from becoming an unexplained spinner:
 *
 * 1. session still resolving   -> loader
 * 2. no session                -> redirect to login (loader while it runs)
 * 3. session but profile failed-> retryable error, never a spinner
 * 4. both loaded               -> the page itself
 */
function GuardedContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, profile, error, refresh } = useProfile();

  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (retrying) {
      return;
    }

    setRetrying(true);

    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }, [retrying, refresh]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  // 1. Authentication (and the profile row) is still resolving.
  if (status === "loading") {
    return <PageLoader label="Checking your session..." />;
  }

  // 2. Unauthenticated: hold the loader for the single frame it takes the
  //    redirect above to take effect, so no protected markup flashes.
  if (status === "unauthenticated") {
    return <PageLoader label="Redirecting to sign in..." />;
  }

  // 3. Authenticated but the profile could not be read. A retry, not a
  //    spinner: the request has already failed, so waiting longer is a lie.
  if (status === "error" || !profile) {
    return (
      <div className="mx-auto w-full max-w-[1600px] py-8">
        <ErrorState
          message={error || "Unable to load your profile. Please try again."}
          onRetry={handleRetry}
          retryLabel={retrying ? "Trying again..." : "Try Again"}
          retryDisabled={retrying}
        />
      </div>
    );
  }

  // 4. Session and profile are both loaded.
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
