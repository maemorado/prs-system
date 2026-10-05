import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Small read helpers shared by the pages that show people and departments.
 *
 * Two things are true everywhere in this app and neither needs repeating:
 *
 * 1. A request stores only the id of the person who asked for it, so showing a
 *    name means reading `profiles` for the rows currently on screen. Resolving
 *    them by id — rather than loading the whole table and looking the ids up in
 *    JavaScript — is what keeps a list of any length to one extra request of
 *    `pageSize` rows, and it is the pattern the History page already used.
 * 2. Counts that do not depend on the visible filters are `head` requests:
 *    PostgREST runs the query and returns the number of matching rows without
 *    sending a single one.
 *
 * Everything here reads through the caller's own session, so Row Level Security
 * remains the authority on what is visible.
 */

export type ProfileSummary = {
  id: string;
  full_name: string;
  employee_id: string | null;
  department_id: string | null;
};

export type ProfileMap = Map<string, ProfileSummary>;

export type RequestSummary = {
  id: string;
  request_number: string;
  title: string;
  status: string;
  requested_by: string;
};

export type RequestSummaryMap = Map<string, RequestSummary>;

/** Ids of the requesters, de-duplicated, with blanks removed. */
export function uniqueIds(
  values: (string | null | undefined)[]
): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

/**
 * Reads the given profiles into a map keyed by id.
 *
 * Returns an empty map when there is nothing to ask about, so callers never
 * issue an `in.()` filter with an empty list.
 */
export async function loadProfilesById(
  supabase: SupabaseClient,
  ids: (string | null | undefined)[]
): Promise<ProfileMap> {
  const wanted = uniqueIds(ids);

  if (wanted.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, employee_id, department_id")
    .in("id", wanted);

  if (error) {
    // A name that cannot be resolved is a display problem, not a reason to
    // fail the page: the row itself is still valid and worth showing.
    console.error("Profile lookup failed:", error);

    return new Map();
  }

  const map: ProfileMap = new Map();

  for (const profile of data ?? []) {
    map.set(profile.id, profile);
  }

  return map;
}

/**
 * Reads the given requests into a map keyed by id.
 *
 * The mirror of `loadProfilesById`, for tables that store only a request id:
 * Approval History rows hold `request_id` and need the number and title to be
 * readable. Resolving just the current page keeps that lookup to `pageSize` rows.
 */
export async function loadRequestsById(
  supabase: SupabaseClient,
  ids: (string | null | undefined)[]
): Promise<RequestSummaryMap> {
  const wanted = uniqueIds(ids);

  if (wanted.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("purchase_requests")
    .select("id, request_number, title, status, requested_by")
    .in("id", wanted);

  if (error) {
    console.error("Request lookup failed:", error);

    return new Map();
  }

  const map: RequestSummaryMap = new Map();

  for (const request of data ?? []) {
    map.set(request.id, request);
  }

  return map;
}

/** Every department, keyed by id. Small reference table, loaded once. */
export async function loadDepartmentNames(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Department lookup failed:", error);

    return new Map();
  }

  const map = new Map<string, string>();

  for (const department of data ?? []) {
    map.set(department.id, department.name);
  }

  return map;
}

/**
 * How many purchase requests carry a given status.
 *
 * The dashboards' summary cards have to describe *every* request, not the ones
 * that happen to be on screen, so this is a `head` query: it counts server-side
 * and transfers no rows.
 */
export async function countRequestsByStatus(
  supabase: SupabaseClient,
  status?: string
): Promise<number> {
  let query = supabase
    .from("purchase_requests")
    .select("id", { count: "exact", head: true });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Request count failed:", error);

    return 0;
  }

  return count ?? 0;
}

/** The slices of the directory the summary cards report on. */
export type ProfileCountFilter = "approver" | "unassigned";

/** How many profiles match a filter, without loading any of them. */
export async function countProfiles(
  supabase: SupabaseClient,
  filter?: ProfileCountFilter
): Promise<number> {
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (filter === "approver") {
    query = query.eq("role", "approver");
  }

  if (filter === "unassigned") {
    query = query.is("department_id", null);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Profile count failed:", error);

    return 0;
  }

  return count ?? 0;
}

/**
 * How many approval log entries carry a given action.
 *
 * Same reasoning as `countRequestsByStatus`: the History page's cards describe
 * the whole history, not the current page of it.
 */
export async function countApprovalActions(
  supabase: SupabaseClient,
  action?: string
): Promise<number> {
  let query = supabase
    .from("approval_logs")
    .select("id", { count: "exact", head: true });

  if (action && action !== "all") {
    query = query.eq("action", action);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Approval action count failed:", error);

    return 0;
  }

  return count ?? 0;
}
