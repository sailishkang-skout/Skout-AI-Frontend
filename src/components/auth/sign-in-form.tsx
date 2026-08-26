"use client";

import { SignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { clerkCallbackPath, clerkPathFromLocation, SIGN_IN_MOUNTS } from "@/lib/clerk-path";

export function SignInForm({ path = "/sign-in" }: { path?: string }) {
  const [ready, setReady] = useState(false);
  const [clerkPath, setClerkPath] = useState(path);
  const [callbackUrl, setCallbackUrl] = useState("/app/auth/callback");

  useEffect(() => {
    const pathname = window.location.pathname;
    setClerkPath(clerkPathFromLocation(pathname, SIGN_IN_MOUNTS, path));
    setCallbackUrl(clerkCallbackPath(pathname));
    setReady(true);
  }, [path]);

  return (
    <div className="w-full max-w-[min(100vw-2rem,24rem)]">
      {!ready ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-xl border bg-card p-8 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading sign in" />
        </div>
      ) : (
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#2563eb",
            },
            elements: {
              rootBox: "w-full",
              card: "w-full max-w-none shadow-sm",
            },
          }}
          routing="path"
          path={clerkPath}
          signUpUrl={clerkPath.startsWith("/app") ? "/app/sign-in" : "/sign-in"}
          forceRedirectUrl={callbackUrl}
          fallbackRedirectUrl={callbackUrl}
        />
      )}
    </div>
  );
}
