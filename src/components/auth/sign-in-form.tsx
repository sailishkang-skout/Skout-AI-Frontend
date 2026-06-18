"use client";

import { SignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getAppOrigin } from "@/lib/app-url";

export function SignInForm() {
  const [ready, setReady] = useState(false);
  const appOrigin = getAppOrigin();
  const callbackUrl = appOrigin ? `${appOrigin}/auth/callback` : "/auth/callback";

  useEffect(() => {
    setReady(true);
  }, []);

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
          path="/sign-in"
          signUpUrl={appOrigin ? `${appOrigin}/sign-up` : "/sign-up"}
          forceRedirectUrl={callbackUrl}
          fallbackRedirectUrl={callbackUrl}
        />
      )}
    </div>
  );
}
