"use client";

import { ClerkProvider } from "@clerk/nextjs";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, isRetryableAuthError } from "@/lib/api-client";
import { getAppOrigin } from "@/lib/app-url";
import { createClientLogger, logAndCapture } from "@/lib/logger";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { CreditsModalProvider } from "@/components/credits/insufficient-credits-modal";
import { PostHogProvider } from "@/components/posthog-provider";
import { ExtensionAuthSync } from "@/components/extension-auth-sync";
import { StubExtensionAuthSync } from "@/components/stub-extension-auth-sync";

const log = createClientLogger("react-query");

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // ApiError is already logged in api-client; only capture unexpected failures.
            if (error instanceof ApiError || isRetryableAuthError(error)) return;
            logAndCapture(log, error, "query failed", { queryKey: query.queryKey });
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (error instanceof ApiError || isRetryableAuthError(error)) return;
            logAndCapture(log, error, "mutation failed", {
              mutationKey: mutation.options.mutationKey,
            });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
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
          <StubExtensionAuthSync />
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
          signInUrl="/app/sign-in"
          signUpUrl="/app/sign-in"
          signInFallbackRedirectUrl="/app/auth/callback"
          signUpFallbackRedirectUrl="/app/auth/callback"
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
