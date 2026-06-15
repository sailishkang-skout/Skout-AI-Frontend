"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isRetryableAuthError } from "@/lib/api-client";
import { ThemeProvider } from "@/components/theme/theme-provider";

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

  if (!publishableKey) {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ClerkProvider
        publishableKey={publishableKey}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      >
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
}
