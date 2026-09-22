"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    // 1. Login
    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Unable to get logged-in user.");
      setLoading(false);
      return;
    }

    // 2. Get user's role from profiles
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

    if (profileError) {
      console.error("Profile error:", profileError);

      await supabase.auth.signOut();

      setError("User profile could not be found.");
      setLoading(false);
      return;
    }

    // 3. Redirect based on role
    switch (profile.role) {
      case "employee":
        router.push("/employee/dashboard");
        break;

      case "approver":
        router.push("/approver/dashboard");
        break;

      default:
        await supabase.auth.signOut();

        setError("Your account has an invalid role.");
        setLoading(false);
        return;
    }

    router.refresh();
  }

  return (
    <main>
      <h1>Login</h1>

      <form onSubmit={handleLogin}>
        <div>
          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}