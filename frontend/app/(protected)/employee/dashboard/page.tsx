"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

export default function DashboardPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setName(profile.full_name);
      }
    }

    loadUser();
  }, [supabase]);

  return (
    <main>
      <h1>Dashboard</h1>

      <p>Welcome, {name}</p>
      <p>{email}</p>
    </main>
  );
}