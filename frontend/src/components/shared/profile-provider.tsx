"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/client";
import { friendlyError } from "@/src/lib/errors";

/**
 * The shape of the `profiles` row that the app displays.
 *
 * This is the single source of truth for profile information in the UI. Every
 * surface (sidebar, profile page, dashboard greeting) reads from here so a
 * profile edit is reflected everywhere at once.
 */
export type Profile = {
  id: string;
  full_name: string;
  employee_id: string | null;
  role: string;
  department_id: string | null;
};

/**
 * The only fields a user may change about their own profile.
 *
 * `id`, `role`, `created_at` and any other column are deliberately absent: role
 * is privileged data and must never be writable from a normal profile form. The
 * allowlist below is enforced again in `updateProfile`, so a caller cannot smuggle
 * extra columns into the update payload.
 *
 * `department_id` is **optional on purpose**. Business rule: employees do not
 * assign themselves to a department; an approver manages that. Omitting the key
 * leaves the column out of the UPDATE entirely, so a self-service form cannot
 * change it even if it were wired to a control. A caller that does pass the key
 * (the approver's own profile page) keeps the previous behaviour.
 */
export type EditableProfileFields = {
  full_name: string;
  employee_id: string | null;
  department_id?: string | null;
};

export const EDITABLE_PROFILE_FIELDS = [
  "full_name",
  "employee_id",
  "department_id",
] as const satisfies readonly (keyof EditableProfileFields)[];

const PROFILE_COLUMNS =
  "id, full_name, employee_id, role, department_id";

/**
 * The five states a protected page can be in.
 *
 * They are deliberately distinct so a screen never has to guess:
 *
 * 1. `loading`         — auth is still resolving the session and profile.
 * 2. `unauthenticated` — there is no session; the shell redirects to login.
 * 3. `authenticated`   — session *and* profile row are loaded.
 * 4. `error`           — a session exists but the profile could not be read;
 *                        the shell shows a retry instead of a spinner.
 *
 * (`authenticated` covers "profile loaded"; the profile row itself is `null`
 * only in `error`, which is what makes an infinite "still checking" state
 * impossible once a request has failed.)
 */
type Status = "loading" | "authenticated" | "unauthenticated" | "error";

type ProfileContextValue = {
  user: User | null;
  profile: Profile | null;
  status: Status;
  error: string;
  refresh: () => Promise<void>;
  updateProfile: (
    fields: EditableProfileFields
  ) => Promise<{ error: string | null }>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

const MAX_FULL_NAME_LENGTH = 120;

export function ProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  // Guards against setting state after the provider unmounts, which would
  // otherwise produce late updates when navigating away mid-request.
  const active = useRef(true);

  // Monotonic id identifying the newest load. Every `await` in `load` re-checks
  // it, so a response belonging to a *previous* session is discarded instead of
  // overwriting current state.
  //
  // Without this, a profile fetch started before sign-out can resolve *after* a
  // different user has signed in and repaint the shell with the previous
  // user's name, role and department until the next refresh.
  const loadToken = useRef(0);

  // Deferred follow-up loads scheduled from the auth listener, so they can be
  // cancelled if the provider unmounts before they run.
  const pendingLoads = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = useCallback(async () => {
    const token = ++loadToken.current;

    // True when this response is no longer the one we care about: the provider
    // unmounted, or a newer load (from a new session) has already started.
    const stale = () => !active.current || token !== loadToken.current;

    const supabase = createClient();

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (stale()) {
        return;
      }

      if (authError || !currentUser) {
        setUser(null);
        setProfile(null);
        setError("");
        setStatus("unauthenticated");
        return;
      }

      setUser(currentUser);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", currentUser.id)
        .maybeSingle();

      if (stale()) {
        return;
      }

      if (profileError) {
        console.error("Profile load error:", profileError);

        setProfile(null);
        setError(
          friendlyError(profileError, "Unable to load your profile.")
        );
        setStatus("error");

        return;
      }

      if (!profileData) {
        // Authenticated, but no profile row. The app cannot route by role
        // without one, so surface a clear, actionable message.
        setProfile(null);
        setError("Your profile could not be found. Please contact an administrator.");
        setStatus("error");

        return;
      }

      setProfile(profileData);
      setError("");
      setStatus("authenticated");
    } catch (err) {
      // An unexpected failure must not leave the shell on the spinner
      // forever: it becomes the retryable error state like any other.
      if (stale()) {
        return;
      }

      console.error("Session load error:", err);

      setUser(null);
      setProfile(null);
      setError("Something went wrong while loading your session. Please try again.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    active.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();

    return () => {
      active.current = false;
    };
  }, [load]);

  // Clear cached state as soon as the session is destroyed, so no profile data
  // lingers in memory after a sign-out (including sign-out from another tab).
  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Terminal state: nothing is in flight that could paint over it.
        loadToken.current += 1;

        setUser(null);
        setProfile(null);
        setError("");
        setStatus("unauthenticated");

        return;
      }

      // Only events that can change *who* is signed in reset the profile —
      // and every invalidation schedules its replacement load, so a
      // superseded response can never strand the shell in `loading`.
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // A different user (or a changed identity) is now active. Drop the old
        // profile and return to `loading` so protected pages never render the
        // previous user's data while the new one is being resolved.
        loadToken.current += 1;

        setProfile(null);
        setError("");
        setStatus("loading");

        // Deferred: this callback runs while Supabase holds its internal auth
        // lock, and calling back into the client synchronously from inside it
        // can deadlock. Yielding first lets the lock clear.
        const timer = setTimeout(() => {
          void load();
        }, 0);

        pendingLoads.current.push(timer);

        return;
      }

      // `INITIAL_SESSION` is emitted to *every* new subscriber the moment it
      // subscribes, which is one tick after this provider's own first load has
      // started. Bumping the load token here invalidated that in-flight
      // request, and because no replacement was scheduled, nothing ever
      // resolved the state again — the classic "logged in but the dashboard
      // spins until I refresh". The session it reports is the same one the
      // in-flight `getUser()` is already validating, so it is left alone.
      //
      // `TOKEN_REFRESHED` is likewise not an identity change: it rotates the
      // access token roughly hourly and must not blank the shell.
    });

    return () => {
      subscription.unsubscribe();

      for (const timer of pendingLoads.current) {
        clearTimeout(timer);
      }

      pendingLoads.current = [];
    };
  }, [load]);

  // Re-validate the session when the tab regains focus so a session that expired
  // or was revoked elsewhere is noticed, and so an edit made in another tab is
  // picked up. This mirrors the refetch-on-focus pattern already used by the
  // list and dashboard pages.
  useEffect(() => {
    function handleFocus() {
      if (status === "authenticated") {
        void load();
      }
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [status, load]);

  const updateProfile = useCallback(
    async (fields: EditableProfileFields) => {
      const fullName = fields.full_name.trim();

      if (!fullName) {
        return { error: "Full name is required." };
      }

      if (fullName.length > MAX_FULL_NAME_LENGTH) {
        return {
          error: `Full name must be ${MAX_FULL_NAME_LENGTH} characters or fewer.`,
        };
      }

      const supabase = createClient();

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        return { error: "You are not signed in." };
      }

      // Built from the allowlist explicitly: `role`, `id` and other privileged
      // columns can never be included, regardless of what the caller passes.
      const payload: EditableProfileFields = {
        full_name: fullName,
        employee_id: fields.employee_id?.trim() || null,
      };

      // Only sent when the caller actually supplied it. Omitting the key means
      // PostgREST leaves `department_id` untouched, which is what stops a
      // self-service profile form from reassigning the user's department.
      if (fields.department_id !== undefined) {
        payload.department_id = fields.department_id || null;
      }

      // Scoped to the authenticated user's own id, so the client can only ever
      // write to its own row. Row Level Security is still the real authority;
      // the `select` below simply lets us detect a denied write instead of
      // silently reporting success.
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", currentUser.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle();

      if (updateError) {
        console.error("Profile update error:", updateError);

        return {
          error: friendlyError(
            updateError,
            "Unable to update your profile. Please try again."
          ),
        };
      }

      if (!updated) {
        // No error, but nothing was written: the update was filtered out by
        // Row Level Security. Reporting success here would be a lie.
        return {
          error:
            "Unable to update your profile. You are not allowed to make this change.",
        };
      }

      // Update local state from the row the database actually stored, so every
      // consumer of this context (sidebar, dashboard, this page) shows the new
      // values immediately with no refetch and no full page reload.
      setProfile((previous) =>
        previous
          ? {
              ...previous,
              ...payload,
              // Preserve server-owned values rather than trusting local edits.
              id: updated.id,
              role: updated.role,
            }
          : updated
      );

      return { error: null };
    },
    []
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      user,
      profile,
      status,
      error,
      refresh: load,
      updateProfile,
    }),
    [user, profile, status, error, load, updateProfile]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider.");
  }

  return context;
}
