"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ClipboardList, TriangleAlert } from "lucide-react";

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
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-indigo-600 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute -top-24 -right-24 size-96 rounded-full bg-indigo-500/40 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -left-16 size-96 rounded-full bg-indigo-400/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3 text-white">
          <span className="flex size-10 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
            <ClipboardList className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Purchase Request System
          </span>
        </div>

        <div className="relative max-w-md space-y-4 text-white">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">
            Streamline how your organization requests and approves purchases.
          </h1>

          <p className="text-sm leading-relaxed text-indigo-100">
            Submit purchase requests, track their status in real time, and let
            approvers review them in one centralized workspace.
          </p>
        </div>

        <p className="relative text-xs text-indigo-100/70">
          Employee &amp; Approver Portal
        </p>
      </div>

      {/* Login form */}
      <div className="flex items-center justify-center bg-muted/40 px-4 py-12 sm:px-6 lg:px-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <span className="mb-2 flex size-11 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <ClipboardList className="size-5" />
            </span>

            <CardTitle className="text-xl">Welcome back</CardTitle>

            <CardDescription>
              Sign in to access your purchase request workspace.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>

                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>

                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Unable to sign in</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}