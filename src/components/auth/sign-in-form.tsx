"use client";

import { SignIn } from "@clerk/nextjs";
import { Loader2, Eye, EyeOff, Mail, AlertCircle, LogIn, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { clerkCallbackPath, clerkPathFromLocation, SIGN_IN_MOUNTS } from "@/lib/clerk-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { customSignIn, isCustomAuthMode } from "@/lib/auth/custom-auth-adapter";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { getApiBase } from "@/lib/api-client";

type Step = "email" | "methods" | "password" | "otp" | "reset-password" | "set-new-password";
type DiscoverData = {
  methods: string[];
  mustReset: boolean;
  hasGoogleIdentity: boolean;
  isExistingUser: boolean;
};

async function discoverAuthMethods(email: string): Promise<DiscoverData> {
  const res = await fetch(`${getApiBase()}/api/v1/auth/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json() as { data?: DiscoverData; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Failed to discover auth methods");
  return body.data!;
}

async function sendOtp(email: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json() as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Failed to send code");
}

async function verifyOtp(email: string, code: string): Promise<{ accessToken: string; expiresIn: number; user: { id: string; email: string } }> {
  const res = await fetch(`${getApiBase()}/api/v1/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const body = await res.json() as { data?: { accessToken: string; expiresIn: number; user: { id: string; email: string } }; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Invalid code");
  return body.data!;
}

async function sendPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/v1/auth/password/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json() as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Failed to send reset link");
}

export function SignInForm({ path = "/sign-in" }: { path?: string }) {
  const [mountedPath, setMountedPath] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [discoverData, setDiscoverData] = useState<DiscoverData | null>(null);
  const [clerkSessionEnded, setClerkSessionEnded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if we came from a Clerk session that ended due to migration
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("clerk_session_ended") === "true") {
      setClerkSessionEnded(true);
    }

    if (!isCustomAuthMode()) {
      const detectedPath = clerkPathFromLocation(window.location.pathname, SIGN_IN_MOUNTS, "/sign-in");
      setMountedPath(detectedPath);
    }
    setReady(true);
  }, []);

  const discoverMut = useMutation({
    mutationFn: () => discoverAuthMethods(email),
    onSuccess: (data) => {
      setDiscoverData(data);
      // If user must reset password, go straight to reset flow
      if (data.mustReset) {
        setStep("set-new-password");
      } else {
        setStep("methods");
      }
    },
  });

  const sendOtpMut = useMutation({
    mutationFn: () => sendOtp(email),
    onSuccess: () => {
      setStep("otp");
    },
  });

  const verifyOtpMut = useMutation({
    mutationFn: () => verifyOtp(email, otp.trim()),
    onSuccess: (data) => {
      customSignIn({ accessToken: data.accessToken, expiresIn: data.expiresIn, user: data.user });
      router.push("/prospects/search");
    },
  });

  const passwordSignInMut = useMutation({
    mutationFn: () => customSignIn({ email, password }),
    onSuccess: () => {
      router.push("/prospects/search");
    },
  });

  const sendResetMut = useMutation({
    mutationFn: () => sendPasswordReset(email),
    onSuccess: () => {
      // Show success message
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      discoverMut.mutate();
    }
  };

  // Clerk mode rendering
  if (!isCustomAuthMode()) {
    if (!ready || !mountedPath) {
      return (
        <div className="flex w-full max-w-[min(100vw-2rem,24rem)] flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading sign in…</p>
        </div>
      );
    }

    const callbackUrl = clerkCallbackPath(mountedPath);

    return (
      <div className="w-full max-w-[min(100vw-2rem,24rem)]">
        {clerkSessionEnded && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-800">
              We&apos;ve updated our authentication system. Please sign in again to continue.
            </span>
          </Alert>
        )}
        <SignIn
          path={mountedPath}
          signUpUrl={path.replace("/sign-in", "/sign-up")}
          afterSignInUrl={callbackUrl}
          afterSignUpUrl={callbackUrl}
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none border rounded-xl",
            },
          }}
        />
      </div>
    );
  }

  // Custom auth mode rendering (AUTH-FE-16 Migration UX)
  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "email" && "Enter your email to sign in"}
          {step === "methods" && "Choose how you'd like to sign in"}
          {step === "password" && "Enter your password to continue"}
          {step === "otp" && "Enter the code sent to your email"}
          {step === "set-new-password" && "Set a new password for your account"}
          {step === "reset-password" && "Reset your password"}
        </p>
      </div>

      {/* Clerk session migration notice */}
      {clerkSessionEnded && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-800">
              We&apos;ve upgraded our authentication system. Please sign in again with your new credentials.
            </span>
          </Alert>
        )}

      {/* In-app migration banner (placeholder for Aditya&apos;s copy) */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <LogIn className="h-4 w-4 text-blue-600" />
        <span className="text-blue-800">
          We&apos;ve completed our account migration. Access your account with your new login method.
        </span>
      </Alert>

      {/* Step: Enter email (identifier-first) */}
      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={discoverMut.isPending}
          >
            {discoverMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Continue
          </Button>
        </form>
      )}

      {/* Step: Choose auth method */}
      {step === "methods" && discoverData && (
        <div className="space-y-3">
          {/* Show password login if available */}
          {discoverData.methods.includes("password") && !discoverData.mustReset && (
            <Button 
              variant="default" 
              className="w-full justify-start gap-2"
              onClick={() => setStep("password")}
            >
              <LogIn className="h-4 w-4" />
              Sign in with password
            </Button>
          )}

          {/* Show Google login if available */}
          {discoverData.hasGoogleIdentity && (
            <Button 
              variant="secondary" 
              className="w-full justify-start gap-2"
              onClick={() => {
                // Google OAuth flow would go here
                window.location.href = `${getApiBase()}/api/v1/auth/google/login?email=${encodeURIComponent(email)}`;
              }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.78 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
          )}

          {/* Show OTP option for magic-link only users */}
          {discoverData.methods.includes("otp") && (
            <Button 
              variant="secondary" 
              className="w-full justify-start gap-2"
              onClick={() => sendOtpMut.mutate()}
              disabled={sendOtpMut.isPending}
            >
              <Mail className="h-4 w-4" />
              {sendOtpMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Email me a code"}
            </Button>
          )}

          {/* Back button */}
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => setStep("email")}
          >
            Use a different email
          </Button>
        </div>
      )}

      {/* Step: Password login */}
      {step === "password" && (
        <form onSubmit={(e) => { e.preventDefault(); passwordSignInMut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={passwordSignInMut.isPending}
          >
            {passwordSignInMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
          <Button 
            type="button"
            variant="ghost" 
            className="w-full text-sm"
            onClick={() => { sendResetMut.mutate(); setStep("reset-password"); }}
          >
            Forgot your password?
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => setStep("methods")}
          >
            Back
          </Button>
        </form>
      )}

      {/* Step: OTP verification */}
      {step === "otp" && (
        <form onSubmit={(e) => { e.preventDefault(); verifyOtpMut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
              className="w-full text-center tracking-widest text-lg"
            />
            <p className="text-xs text-center text-muted-foreground">
              Did not receive a code?{" "}
              <button type="button" className="underline" onClick={() => sendOtpMut.mutate()}>
                Resend
              </button>
            </p>
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={verifyOtpMut.isPending || otp.length < 6}
          >
            {verifyOtpMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify code"}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => setStep("methods")}
          >
            Back
          </Button>
        </form>
      )}

      {/* Step: Set new password (must_reset users) */}
      {step === "set-new-password" && (
        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span className="text-blue-800">
              This is your first time logging in. Please set a new password to continue.
            </span>
          </Alert>
          <form onSubmit={(e) => { e.preventDefault(); sendResetMut.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={sendResetMut.isPending}
            >
              {sendResetMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send password reset link"}
            </Button>
          </form>
        </div>
      )}

      {/* Step: Reset password */}
      {step === "reset-password" && (
        <div className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-green-800">
              If an account exists with this email, we&apos;ve sent a password reset link.
            </span>
          </Alert>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => setStep("email")}
          >
            Back to sign in
          </Button>
        </div>
      )}
    </div>
  );
}