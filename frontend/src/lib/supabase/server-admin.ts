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

/**
 * The environment variables this server needs, by name.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is the one privileged value, and it is
 * deliberately NOT a `NEXT_PUBLIC_*` variable: Next.js inlines anything with
 * that prefix into the browser bundle, so a privileged key must never use it.
 * The other two are public by design and are read by the browser as well.
 *
 * All three have to be present in every environment the app is deployed to,
 * including Vercel's Production environment. A missing service-role key is the
 * reason account creation works on localhost and fails on a fresh deployment:
 * localhost reads `.env.local`, a Vercel function reads whatever the project
 * has configured for it.
 */
export const ENV_SUPABASE_URL = "NEXT_PUBLIC_SUPABASE_URL";
export const ENV_SUPABASE_PUBLISHABLE_KEY =
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
export const ENV_SUPABASE_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * The copy the browser is allowed to see for any failure whose cause is
 * internal to the server. Supabase and PostgREST messages can name endpoints,
 * tables, columns, constraints and SQL, so those details are logged and only
 * this string crosses back to the client.
 */
const GENERIC_FAILURE_MESSAGE =
  "Unable to create the account. Please try again.";

/** Roles permitted to create accounts. These already exist in `profiles.role`. */
const ACCOUNT_CREATOR_ROLES = new Set(["approver", "admin"]);

/** Truncation limit for anything written to the server log. */
const LOG_VALUE_LIMIT = 300;

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

type ServerEnv = {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
};

/**
 * Reads one environment variable at request time.
 *
 * The name is passed in as a value instead of written out as
 * `process.env.SUPABASE_SERVICE_ROLE_KEY` at each call site. That is
 * deliberate: a literal property access on `process.env` can be substituted at
 * build time, which freezes whatever value the *build* environment happened to
 * hold. On Vercel that means a key added or rotated in the project dashboard
 * can keep arriving as `undefined` until the next build, and the endpoint then
 * refuses to run. Going through a variable keeps this a genuine runtime read of
 * the function's own environment, so the value is correct on the first request
 * after it is configured.
 *
 * The value never leaves the server: callers get booleans and error objects,
 * never the key itself.
 */
function readEnv(name: string): string {
  const value = process.env[name];

  return typeof value === "string" ? value.trim() : "";
}

function loadEnv(): ServerEnv {
  return {
    url: readEnv(ENV_SUPABASE_URL),
    publishableKey: readEnv(ENV_SUPABASE_PUBLISHABLE_KEY),
    serviceRoleKey: readEnv(ENV_SUPABASE_SERVICE_ROLE_KEY),
  };
}

/**
 * Which of the required variables are absent right now.
 *
 * Names only — never values — because this is written to the function log so
 * whoever deploys can see exactly what to add in Vercel.
 */
export function missingEnvVars(): string[] {
  const env = loadEnv();
  const missing: string[] = [];

  if (!env.url) {
    missing.push(ENV_SUPABASE_URL);
  }

  if (!env.publishableKey) {
    missing.push(ENV_SUPABASE_PUBLISHABLE_KEY);
  }

  if (!env.serviceRoleKey) {
    missing.push(ENV_SUPABASE_SERVICE_ROLE_KEY);
  }

  return missing;
}

/**
 * Whether the server has been given everything it needs to create accounts.
 *
 * Checked before any work starts, so a missing setup produces one clear log
 * entry instead of a confusing auth error partway through.
 */
export function isAccountCreationConfigured(): boolean {
  const env = loadEnv();

  return Boolean(env.url && env.serviceRoleKey);
}

/**
 * Writes the missing variable names to the server log, once per process.
 *
 * This is the only practical way to diagnose a deployment that has not been
 * given the key: the browser never learns the variable name, only that the
 * attempt failed. Called from the endpoint the first time it refuses to run.
 */
let hasReportedMissingEnvVars = false;

export function reportMissingEnvVarsOnce(): void {
  if (hasReportedMissingEnvVars) {
    return;
  }

  const missing = missingEnvVars();

  if (missing.length === 0) {
    return;
  }

  hasReportedMissingEnvVars = true;

  console.error(
    "[create-account] account creation is unavailable on this deployment. Missing environment variable(s):",
    missing.join(", "),
    `| node=${process.env.NODE_ENV ?? "unknown"}`,
    "| set them in the deployment platform (Vercel: Project Settings -> Environment Variables, for every environment)."
  );
}

/**
 * A client carrying the *caller's* session, built from their request cookies.
 *
 * Used to identify who is asking. `auth.getUser()` revalidates the JWT against
 * the auth server, so a doctored cookie cannot pass as an approver.
 */
async function createSessionClient() {
  const env = loadEnv();

  if (!env.url || !env.publishableKey) {
    reportMissingEnvVarsOnce();

    throw new AccountCreationError(
      GENERIC_FAILURE_MESSAGE,
      500,
      "server_misconfigured"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.publishableKey, {
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
      GENERIC_FAILURE_MESSAGE,
      500,
      "profile_lookup_failed"
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
  const env = loadEnv();

  if (!env.url || !env.serviceRoleKey) {
    reportMissingEnvVarsOnce();

    throw new AccountCreationError(
      "Account creation is not available on this server.",
      503,
      "not_configured",
    );
  }

  return createClient(env.url, env.serviceRoleKey, {
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
 * On failure after the sign-in exists, *both* rows it left behind are removed —
 * the sign-in and the profile row the database trigger created for it — so the
 * request either fully succeeds or fully leaves no trace. A partial result was
 * the worse outcome: an account appeared in User Management that no one could
 * sign in to, and every retry added another one.
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
    logAuthCreateFailure(createError);

    throw new AccountCreationError(
      mapAuthError(createError?.message ?? ""),
      409,
      "auth_create_failed",
    );
  }

  const userId = created.user.id;

  // Approvers are expected to belong to a department, and the business default
  // is Finance. If the request carried none, resolve it here — server-side,
  // one lookup through the privileged client — instead of storing a
  // department-less approver. An explicit choice is never overridden, and if
  // Finance cannot be found the account is created unassigned rather than
  // failing the whole request. The create dialog applies the same default in
  // the UI so the two paths cannot diverge.
  let departmentId = input.departmentId;

  if (!departmentId && input.role === "approver") {
    const { data: financeDepartment } = await admin
      .from("departments")
      .select("id")
      .ilike("name", "financ%")
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();

    departmentId = financeDepartment?.id ?? null;
  }

  // The database has a trigger that creates the `profiles` row as soon as the
  // sign-in exists, so the row is normally already present here. An insert
  // would therefore always fail on the primary key, and the rollback below
  // would then delete the sign-in that was working perfectly.
  //
  // So: update the existing row, and insert only if the trigger somehow did not
  // run. This is also why the role must be written explicitly — the trigger
  // ignores the role in `user_metadata` and applies its own default, so an
  // approver created this way would otherwise end up as an employee.
  const details = {
    full_name: input.fullName,
    employee_id: input.employeeId,
    role: input.role,
    department_id: departmentId,
  };

  const { data: updatedRows, error: updateError } = await admin
    .from("profiles")
    .update(details)
    .eq("id", userId)
    .select("id");

  if (updateError) {
    await failProfileWrite(admin, userId, "update", updateError);
  }

  // No row was updated, so the trigger did not create one. Create it now.
  if (!updatedRows || updatedRows.length === 0) {
    const { error: insertError } = await admin
      .from("profiles")
      .insert({ id: userId, ...details });

    if (insertError) {
      await failProfileWrite(admin, userId, "insert", insertError);
    }
  }

  return { id: userId, email: input.email };
}

/**
 * Handles a profile write that failed *after* the sign-in already exists.
 *
 * Two things have to be true here, and both were wrong before:
 *
 * 1. The write is undone completely. Removing the sign-in is not enough: the
 *    database trigger has already created a profile row for it, and nothing
 *    links that row to a sign-in once the sign-in is gone. Leaving it behind
 *    put an account in the User Management list that nobody could ever sign in
 *    to, and a retry with the same email added a second one. Because the id
 *    was minted seconds ago by this request, that row cannot be anything the
 *    caller cared about keeping.
 *
 * 2. The reason is reported accurately. "Nothing was saved" was simply false
 *    while a row survived, and the generic wording hid the one cause an
 *    approver can actually fix: an employee ID that is already assigned.
 */
async function failProfileWrite(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  stage: "update" | "insert",
  error: unknown
): Promise<never> {
  const record = asRecord(error);

  // Server-side only, and the raw message names a constraint and a table, so
  // it is logged rather than returned. The browser gets `mapped` below.
  console.error(
    `[create-account] profile ${stage} failed:`,
    JSON.stringify({
      code: pickString(record["code"]),
      message: pickString(record["message"]),
      details: pickString(record["details"]),
    })
  );

  const mapped = mapProfileWriteError(record);

  // The trigger's row goes first. Without its sign-in it is unusable, and
  // leaving it is exactly what made a failed attempt look like a success.
  const { error: profileCleanupError } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);

  const { error: authCleanupError } = await admin.auth.admin.deleteUser(userId);

  if (profileCleanupError || authCleanupError) {
    console.error(
      "[create-account] cleanup after a failed profile write did not fully succeed:",
      JSON.stringify({
        profile: pickString(asRecord(profileCleanupError)["code"]),
        auth: pickString(asRecord(authCleanupError)["code"]),
      })
    );

    throw new AccountCreationError(
      "The account could not be created, and the automatic cleanup did not finish. Please contact an administrator.",
      500,
      "cleanup_failed",
    );
  }

  throw new AccountCreationError(mapped.message, mapped.status, mapped.code);
}

/**
 * Turns a profile write failure into ordinary language.
 *
 * Only PostgREST's SQLSTATE is branched on. The constraint name inside the raw
 * message is used to pick between two of *our own* messages and is never shown.
 */
function mapProfileWriteError(error: Record<string, unknown>): {
  message: string;
  status: number;
  code: string;
} {
  const sqlState = typeof error["code"] === "string" ? error["code"] : "";

  const text = `${String(error["message"] ?? "")} ${
    String(error["details"] ?? "")
  }`.toLowerCase();

  // 23505 = unique_violation.
  if (sqlState === "23505") {
    if (text.includes("employee_id")) {
      return {
        message:
          "That employee ID is already assigned to another account. Please use a different one.",
        status: 409,
        code: "employee_id_taken",
      };
    }

    return {
      message: "Those details are already used by another account.",
      status: 409,
      code: "duplicate_details",
    };
  }

  // 23503 = foreign_key_violation, which here can only be the department.
  if (sqlState === "23503") {
    return {
      message: "Select a valid department.",
      status: 400,
      code: "invalid_department",
    };
  }

  return {
    message: GENERIC_FAILURE_MESSAGE,
    status: 500,
    code: "profile_create_failed",
  };
}

/**
 * Writes the auth server's own diagnostic detail to the server log.
 *
 * Server-side only. The client still receives only the generic message from
 * `mapAuthError`, so this narrows nothing on the browser side.
 *
 * Only non-secret fields are read: the auth error never carries the key, the
 * password, or any token. `message`, `name`, `status`, `code` and `hint` are
 * the auth server's own diagnostic strings. Anything is escaped to newlines so
 * a multi-line value cannot forge extra log lines, and the values are truncated
 * to keep the log readable.
 *
 * The status and code also make a misconfigured key obvious: a key that is
 * valid but not privileged comes back here as 401/403 rather than a constraint
 * error.
 */
function logAuthCreateFailure(error: unknown): void {
  // No error object at all: the call returned neither a user nor a reason.
  if (!error || typeof error !== "object") {
    console.error(
      "[create-account] auth admin createUser returned no user and no error"
    );

    return;
  }

  const record = asRecord(error);

  console.error(
    "[create-account] auth admin createUser failed:",
    JSON.stringify({
      name: pickString(record["name"]),
      message: pickString(record["message"]),
      status: pickNumber(record["status"]),
      code: pickString(record["code"]),
      hint: pickString(record["hint"]),
    })
  );
}

/**
 * Reads a field off a Supabase error object.
 *
 * Supabase's error types are declared as interfaces with no index signature, so
 * reading a possibly-absent field needs the `unknown` hop.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function pickString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  // Collapse newlines and cap the length so the log stays one clean entry.
  return value.replace(/\r?\n/g, " ").slice(0, LOG_VALUE_LIMIT);
}

function pickNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Turns auth-server errors into ordinary language.
 *
 * Raw messages can name endpoints, tables and SQL, so they are logged rather
 * than shown. Anything unrecognised — including a key that turned out not to
 * be privileged — falls through to the generic message.
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

  return GENERIC_FAILURE_MESSAGE;
}

/**
 * The copy and status the endpoint is allowed to return for a given failure.
 *
 * Only the codes below are safe to hand to the browser. Anything else is an
 * internal fault whose real cause is already in the server log, so the client
 * gets the same generic sentence it would get from an unexpected error.
 */
const CLIENT_SAFE_CODES = new Set([
  "unauthenticated",
  "forbidden",
  "not_configured",
  "cleanup_failed",
  "auth_create_failed",
  "employee_id_taken",
  "duplicate_details",
  "invalid_department",
]);

export function toClientError(error: AccountCreationError): {
  error: string;
  code: string;
  status: number;
} {
  if (CLIENT_SAFE_CODES.has(error.code)) {
    return { error: error.message, code: error.code, status: error.status };
  }

  console.error(
    `[create-account] hiding internal failure "${error.code}" from the client`
  );

  return { error: GENERIC_FAILURE_MESSAGE, code: "unexpected", status: 500 };
}
