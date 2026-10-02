import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

/**
 * A short-lived client for one-off sign-up calls, used by the approver's
 * "Create Account" flow.
 *
 * The shared `createClient()` persists its session to cookies. Calling `signUp`
 * on that instance would write the *new* account's session over the approver's
 * own cookie and silently log the approver out mid-task. This instance has
 * persistence and token refresh switched off, so the sign-up response stays in
 * memory, is handed back to the caller, and is then discarded with the client.
 *
 * It carries the same publishable (public) key, so this grants no extra
 * privilege: it is the same permission level any signed-out visitor already has.
 */
export function createEphemeralAuthClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}