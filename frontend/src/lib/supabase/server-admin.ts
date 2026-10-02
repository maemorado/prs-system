import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase clients for privileged operations.
 *
 * Nothing in this file may be imported by a Client Component. `server-only`
 * makes that a build error rather than a silent leak of the service-role key
 * into the browser bundle.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * The service-role key, read only on the server.
 *
 * It is deliberately NOT a `NEXT_PUBLIC_*` variable: Next.js inlines anything
 * with that prefix into the client bundle, so a privileged key must never use
 * it. This module is server-only and `server-only` is enforced at build time.
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Roles permitted to create accounts. These already exist in `profiles.role`. */
const ACCOUNT_CREATOR_ROLES = new Set(["approver", "admin"]);

export class AccountCreationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "AccountCreationError";
  }
}

/**
 * Whether the server has been given a key that can create accounts.
 *
 * Checked before any work starts so the UI can explain a missing setup instead
 * of failing partway through with a confusing auth error.
 */
export function isAccountCreationConfigured(): boolean {
  return Boolean(URL && SERVICE_ROLE_KEY);
}

/**
 * A client carrying the *caller's* session, built from their request cookies.
 *
 * Used to identify who is asking. `auth.getUser()` revalidates the JWT against
 * the auth server, so a doctored cookie cannot pass as an approver.
 */
async function createSessionClient() {
  if (!URL || !PUBLISHABLE_KEY) {
    throw new AccountCreationError(
      "The server is not configured to create accounts.",
      500,
      "server_misconfigured",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Route Handlers can normally write cookies, but this is a no-op-safe
        // path: token refresh mid-request is not needed to authorise a call.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A read-only cookie store throws; the request can still proceed.
        }
      },
    },
  });
}

/**
 * Rejects the request unless a signed-in approver made it.
 *
 * This is the actual authorisation gate for account creation. RLS does not help
 * here, because the privileged write below bypasses it by design — so the check
 * must happen before the key is ever used.
 */
export async function assertApproverRequest(): Promise<string> {
  const supabase = await createSessionClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AccountCreationError(
      "Your session has expired. Please sign in again.",
      401,
      "unauthenticated",
    );
  }

  // Read through the caller's own session, so RLS decides what they can see.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[create-account] profile lookup failed:", profileError);

    throw new AccountCreationError(
      "Unable to verify your access. Please try again.",
      500,
      "profile_lookup_failed",
    );
  }

  if (!profile || !ACCOUNT_CREATOR_ROLES.has(profile.role)) {
    throw new AccountCreationError(
      "You do not have permission to create accounts.",
      403,
      "forbidden",
    );
  }

  return user.id;
}

/**
 * A keyless-of-the-request client holding the service-role key.
 *
 * This is the only place in the app that holds a privileged credential, and it
 * only ever runs on the server.
 */
function createAdminClient() {
  if (!URL || !SERVICE_ROLE_KEY) {
    throw new AccountCreationError(
      "Account creation is not available on this server.",
      503,
      "not_configured",
    );
  }

  return createClient(URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Creates the sign-in, already confirmed, plus its profile row.
 *
 * `email_confirm: true` is the whole point: it marks the address confirmed at
 * creation, so the person can sign in straight away and never enters an email
 * confirmation flow.
 *
 * On failure after the sign-in exists, the sign-in is rolled back rather than
 * left orphaned, so a retry with the same address can succeed.
 */
export async function createAccountWithProfile(input: {
  fullName: string;
  email: string;
  password: string;
  role: string;
  departmentId: string | null;
  employeeId: string | null;
}): Promise<{ id: string; email: string }> {
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    // Only used if the database has a trigger reading this; harmless otherwise.
    user_metadata: { full_name: input.fullName },
  });

  if (createError || !created?.user) {
    console.error("[create-account] auth admin createUser failed:", createError);

    throw new AccountCreationError(
      mapAuthError(createError?.message ?? ""),
      409,
      "auth_create_failed",
    );
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    full_name: input.fullName,
    employee_id: input.employeeId,
    role: input.role,
    department_id: input.departmentId,
  });

  if (profileError) {
    console.error("[create-account] profile insert failed:", profileError);

    // The sign-in works but has no profile, which would leave an account that
    // can sign in and then break. Remove it so the state stays consistent.
    const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);

    if (cleanupError) {
      console.error("[create-account] rollback failed:", cleanupError);

      throw new AccountCreationError(
        "The sign-in was created but its profile could not be saved, and the automatic cleanup failed. Please contact an administrator.",
        500,
        "rollback_failed",
      );
    }

    throw new AccountCreationError(
      "The account could not be created. Nothing was saved — please try again.",
      500,
      "profile_create_failed",
    );
  }

  return { id: userId, email: input.email };
}

/**
 * Turns auth-server errors into ordinary language.
 *
 * Raw messages can name endpoints, tables and SQL, so they are logged rather
 * than shown.
 */
function mapAuthError(raw: string): string {
  const message = raw.toLowerCase();

  if (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("already exists")
  ) {
    return "An account with this email address already exists.";
  }

  if (
    message.includes("password") &&
    (message.includes("at least") || message.includes("weak"))
  ) {
    return "Choose a stronger password.";
  }

  if (message.includes("email") && message.includes("invalid")) {
    return "Enter a valid email address.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return "The account could not be created. Please try again.";
}