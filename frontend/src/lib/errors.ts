/**
 * Translates Supabase / PostgREST / Auth errors into safe, user-facing copy.
 *
 * Raw database errors can expose table names, column names, constraint names and
 * SQL fragments, so they must never be rendered directly to a normal user. The
 * original error is still returned to the caller so it can be logged in the
 * browser console for debugging, but it is never shown on screen.
 */
export function friendlyError(
  error: unknown,
  fallback: string
): string {
  const raw = extractMessage(error);

  if (!raw) {
    return fallback;
  }

  const message = raw.toLowerCase();

  // ------------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------------
  if (
    message.includes("invalid login credentials") ||
    message.includes("user not found") ||
    message.includes("email not confirmed")
  ) {
    return "Incorrect email or password. Please try again.";
  }

  if (
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("security purposes")
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  // ------------------------------------------------------------------
  // Network / connectivity
  // ------------------------------------------------------------------
  if (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror") ||
    message.includes("network request failed")
  ) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  // ------------------------------------------------------------------
  // Authorization (Supabase RLS)
  // ------------------------------------------------------------------
  if (
    message.includes("row-level security") ||
    message.includes("row level security") ||
    message.includes("permission denied") ||
    message.includes("not authorized")
  ) {
    return "You do not have permission to perform this action.";
  }

  // ------------------------------------------------------------------
  // Missing records
  // ------------------------------------------------------------------
  if (
    message.includes("pgrst116") ||
    message.includes("json object requested") ||
    message.includes("not found")
  ) {
    return "The requested record could not be found.";
  }

  // ------------------------------------------------------------------
  // Constraint violations
  // ------------------------------------------------------------------
  if (
    message.includes("duplicate key") ||
    message.includes("already exists")
  ) {
    return "That value is already in use.";
  }

  if (
    message.includes("not-null") ||
    message.includes("null value") ||
    message.includes("violates not-null")
  ) {
    return "Please fill in all required fields.";
  }

  if (message.includes("check constraint")) {
    return "One of the values provided is not allowed.";
  }

  // ------------------------------------------------------------------
  // Anything unrecognised: fall back to safe, non-technical copy.
  // ------------------------------------------------------------------
  return fallback;
}

function extractMessage(error: unknown): string {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown };

    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}
