import { createClient } from "@/src/lib/supabase/client";

export async function getCategories() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description")
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Failed to fetch categories:",
      error
    );

    throw error;
  }

  return data ?? [];
}
