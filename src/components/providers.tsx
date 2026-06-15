"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export function UserProvisioner() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(async (token) => {
      if (!token) return;
      const me = await apiFetch("/api/v1/me", { authToken: token }).catch(() => null);
      if (!me) return;
      const icp = await apiFetch<{ data: unknown | null }>("/api/v1/icp", { authToken: token }).catch(() => null);
      if (icp !== null && !icp?.data) {
        router.push("/onboarding/icp");
      }
    });
  }, [isSignedIn, getToken, router]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <QueryClientProvider client={queryClient}>
        <UserProvisioner />
        {children}
      </QueryClientProvider>
    </ClerkProvider>
  );
}
