"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isRetryableAuthError } from "@/lib/api-client";
import { getAppOrigin } from "@/lib/app-url";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { CreditsModalProvider } from "@/components/credits/insufficient-credits-modal";
import { PostHogProvider } from "@/components/posthog-provider";
import { ExtensionAuthSync } from "@/components/extension-auth-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) =>
              isRetryableAuthError(error) ? failureCount < 3 : failureCount < 1,
            retryDelay: (attempt) => Math.min(1000, 100 * 2 ** attempt),
          },
        },
      })
  );

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const appOrigin = getAppOrigin();

  if (!publishableKey) {
    return (
      <ThemeProvider>
        <PostHogProvider>
          <CreditsModalProvider>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </CreditsModalProvider>
        </PostHogProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <PostHogProvider>
        <ClerkProvider
          publishableKey={publishableKey}
          signInUrl={appOrigin ? `${appOrigin}/sign-in` : "/sign-in"}
          signUpUrl={appOrigin ? `${appOrigin}/sign-up` : "/sign-up"}
          signInFallbackRedirectUrl={appOrigin ? `${appOrigin}/auth/callback` : "/auth/callback"}
          signUpFallbackRedirectUrl={appOrigin ? `${appOrigin}/auth/callback` : "/auth/callback"}
          {...(appOrigin
            ? { allowedRedirectOrigins: [appOrigin] as [string, ...string[]] }
            : {})}
        >
        <ExtensionAuthSync />
        <CreditsModalProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </CreditsModalProvider>
      </ClerkProvider>
      </PostHogProvider>
    </ThemeProvider>
  );
}
