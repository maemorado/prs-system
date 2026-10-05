import { NextResponse } from "next/server";
import {
  AccountCreationError,
  assertApproverRequest,
  createAccountWithProfile,
  isAccountCreationConfigured,
  reportMissingEnvVarsOnce,
  toClientError,
} from "@/src/lib/supabase/server-admin";

/**
 * Creates a sign-in and its profile, server-side.
 *
 * The browser holds only the publishable key, so it cannot confirm an email
 * address or create another user. Both of those need the service-role key,
 * which is why this exists: the request arrives here, the privileged work
 * happens on the server, and only the result crosses back to the client.
 */

/**
 * Node.js explicitly.
 *
 * The default already is, but this endpoint reads cookies through
 * `next/headers` and talks to Supabase with a privileged key, so the runtime is
 * stated rather than inherited. It is also what makes the deployment's function
 * logs — the only place the missing-variable diagnostic is visible — come from
 * a Node function instead of anywhere else.
 */
export const runtime = "nodejs";

/**
 * Always executed per request.
 *
 * Without this a cached response would be served from the environment in which
 * the app was built, and the key this endpoint reads would never be looked up
 * again after being configured on the deployment platform.
 */
export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const MAX_NAME_LENGTH = 120;

// Node's FormData/type helpers are not used; JSON keeps the payload explicit.
export async function POST(request: Request) {
  if (!isAccountCreationConfigured()) {
    // Server-side only: names the missing variables so whoever deploys can see
    // exactly what to add. The browser is told nothing beyond "not available".
    reportMissingEnvVarsOnce();

    return NextResponse.json(
      {
        error:
          "Account creation is not available on this server yet. Please contact an administrator.",
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The request could not be read.", code: "invalid_request" },
      { status: 400 }
    );
  }

  const validation = validate(body);

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.message, code: "invalid_input" },
      { status: 400 }
    );
  }

  try {
    // Authorise before the privileged client is created.
    await assertApproverRequest();

    const account = await createAccountWithProfile(validation.value);

    return NextResponse.json(
      {
        ok: true,
        id: account.id,
        email: account.email,
        message: "Account created successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AccountCreationError) {
      const { error: message, code, status } = toClientError(error);

      return NextResponse.json({ error: message, code }, { status });
    }

    console.error("[create-account] unexpected error:", error);

    return NextResponse.json(
      {
        error: "Unable to create the account. Please try again.",
        code: "unexpected",
      },
      { status: 500 }
    );
  }
}

/**
 * Field checks, repeated here even though the form checks them too.
 *
 * A client-side check is only a convenience; this endpoint is reachable
 * directly, so it cannot rely on the UI having run first.
 */
function validate(
  body: unknown
):
  | { ok: true; value: { fullName: string; email: string; password: string; role: string; departmentId: string | null; employeeId: string | null } }
  | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "The request could not be read." };
  }

  const input = body as Record<string, unknown>;

  const readString = (key: string) =>
    typeof input[key] === "string" ? input[key].trim() : "";

  const fullName = readString("fullName");
  const email = readString("email").toLowerCase();
  const role = readString("role");
  const employeeId = readString("employeeId");

  const rawPassword = typeof input["password"] === "string" ? input["password"] : "";

  // Trimmed at the edges, which is what people actually type by accident.
  const password = rawPassword.trim();

  if (!fullName) {
    return { ok: false, message: "Full name is required." };
  }

  if (fullName.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      message: `Full name must be ${MAX_NAME_LENGTH} characters or fewer.`,
    };
  }

  if (!email) {
    return { ok: false, message: "Email address is required." };
  }

  // Deliberately loose; the auth server is the authority on real addresses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  // Trimmed, so leading/trailing spaces are not silently part of the secret.
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    };
  }

  // bcrypt (used by Supabase auth) silently truncates beyond 72 bytes, which
  // would make the tail of a long password meaningless.
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    };
  }

  // Only the roles that already exist. Inventing new ones here would create
  // accounts the rest of the app cannot route.
  if (role !== "employee" && role !== "approver") {
    return { ok: false, message: "Select a valid role." };
  }

  const rawDepartment = input["departmentId"];
  const departmentId =
    typeof rawDepartment === "string" && rawDepartment.length > 0
      ? rawDepartment
      : null;

  if (departmentId !== null && !UUID_PATTERN.test(departmentId)) {
    return { ok: false, message: "Select a valid department." };
  }

  return {
    ok: true,
    value: { fullName, email, password, role, departmentId, employeeId: employeeId || null },
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
