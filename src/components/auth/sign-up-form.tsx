"use client";

import { SignUp } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { clerkCallbackPath, clerkPathFromLocation, SIGN_UP_MOUNTS } from "@/lib/clerk-path";

export function SignUpForm() {
  const [path, setPath] = useState("/sign-up");
  const [ready, setReady] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/app/auth/callback");

  useEffect(() => {
    const pathname = window.location.pathname;
    setPath(clerkPathFromLocation(pathname, SIGN_UP_MOUNTS, "/sign-up"));
    setCallbackUrl(clerkCallbackPath(pathname));
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <SignUp
      appearance={{
        variables: {
          colorPrimary: "#2563eb",
        },
      }}
      routing="path"
      path={path}
      signInUrl={path.startsWith("/app") ? "/app/signin" : "/signin"}
      forceRedirectUrl={callbackUrl}
      fallbackRedirectUrl={callbackUrl}
    />
  );
}
