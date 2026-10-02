"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/src/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ClipboardList, TriangleAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // A ref (not the `loading` state) guards against double submission: two clicks
  // in the same tick would both read the same stale `false` state value.
  const submitting = useRef(false);

  // Someone who already has a valid session should not be shown the login form
  // again, and should not be able to accidentally sign in as a different user.
  useEffect(() => {
    let cancelled = false;

    async function redirectIfAlreadySignedIn() {
      const supabase = createClient();

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (cancelled || !currentUser) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (cancelled || !profile) {
        return;
      }

      if (profile.role === "employee") {
        router.replace("/employee/dashboard");
      } else if (profile.role === "approver") {
        router.replace("/approver/dashboard");
      }
    }

    void redirectIfAlreadySignedIn();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) {
      return;
    }

    submitting.current = true;

    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      // 1. Authenticate
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        setError(
          friendlyError(loginError, "Unable to sign in. Please try again.")
        );

        return;
      }

      if (!data.user) {
        setError("Unable to get logged-in user.");

        return;
      }

      // 2. Read the role that decides where this user is allowed to go.
      //    `maybeSingle` keeps a missing row from surfacing as a raw database
      //    error to the user.
      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

      if (profileError || !profile) {
        console.error("Profile lookup error:", profileError);

        // Do not leave a half-authenticated session behind.
        await supabase.auth.signOut();

        setError(
          "Your profile could not be found. Please contact an administrator."
        );

        return;
      }

      // 3. Role-based redirect. `replace` keeps the login page out of history so
      //    the Back button does not return to an already-completed login.
      const destination =
        profile.role === "employee"
          ? "/employee/dashboard"
          : profile.role === "approver"
          ? "/approver/dashboard"
          : null;

      if (!destination) {
        await supabase.auth.signOut();

        setError(
          "Your account has an invalid role. Please contact an administrator."
        );

        return;
      }

      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error("Sign in error:", err);

      setError(friendlyError(err, "Unable to sign in. Please try again."));
    } finally {
      // Always release the guard, so a failed attempt can be retried and the
      // button can never get stuck in a permanent "Signing in..." state.
      submitting.current = false;
      setLoading(false);
    }
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