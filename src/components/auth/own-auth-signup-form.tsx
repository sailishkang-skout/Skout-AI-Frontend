"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBase } from "@/lib/api-client";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

// §3: POST /api/v1/auth/signup {email, password, fullName} → 201 {data:{userId}}. No cookies
// are set on signup (the session starts at login, after email verification), so this can call
// the API directly rather than through the FE-05 route-handler layer.
async function signup(input: { email: string; password: string; fullName: string }): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not create your account. Please try again.");
  }
}

export function OwnAuthSignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const signupMut = useMutation({
    mutationFn: () => signup({ email: email.trim(), password, fullName: fullName.trim() }),
  });

  if (signupMut.isSuccess) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
        <h1 className="mt-4 text-lg font-semibold">Check your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a verification link to <strong>{email}</strong>. Click it to activate your account, then sign in.
        </p>
        <a
          href="/sign-in"
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[min(100vw-2rem,24rem)] rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold">Create your Skout account</h1>

      <div className="mt-6">
        <GoogleSignInButton />
      </div>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          signupMut.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-name" className="text-sm font-medium">
            Full name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              autoFocus
              required
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-email" className="text-sm font-medium">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-password" className="text-sm font-medium">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              placeholder="At least 10 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 pr-9"
              aria-describedby="signup-password-hint"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p id="signup-password-hint" className="text-xs text-muted-foreground">
            At least 10 characters. Avoid common or previously-breached passwords.
          </p>
        </div>

        {signupMut.isError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(signupMut.error as Error).message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={signupMut.isPending || password.length < 10}>
          {signupMut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <a href="/sign-in" className="text-primary underline-offset-2 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
