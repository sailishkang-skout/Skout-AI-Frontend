// Auth adapter types and implementations
export type User = {
  id: string;
  email: string;
  name?: string;
  imageUrl?: string;
};

export type Session = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
};

export type GetAccessTokenOptions = {
  forceRefresh?: boolean;
};import React from "react";

export interface AuthAdapter {
  useSession: () => Session;
  useGetAccessToken: () => (options?: GetAccessTokenOptions) => Promise<string | null>;
  useSignOut: () => () => Promise<void>;
  UserMenu?: React.FC;
}
// Auth mode configuration
export type AuthMode = "clerk" | "custom" | "stub";

const AUTH_MODE = (process.env.NEXT_PUBLIC_AUTH_MODE as AuthMode) || "clerk";
const E2E_AUTH_BYPASS = process.env.E2E_AUTH_BYPASS === "true";
const HAS_CLERK_KEY = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Calculate which adapter to use - preserves existing behavior by default
export function resolveAuthMode(): AuthMode {
  // If we're in a test environment (vitest is running), always use stub
  if (typeof vitest !== "undefined") {
    return "stub";
  }
  
  // If E2E auth bypass is enabled, always use stub
  if (E2E_AUTH_BYPASS) {
    return "stub";
  }
  
  // If we have a Clerk key and auth mode is clerk, use clerk
  if (AUTH_MODE === "clerk" && HAS_CLERK_KEY) {
    return "clerk";
  }
  
  // If custom mode is explicitly set, use custom
  if (AUTH_MODE === "custom") {
    return "custom";
  }
  
  // Fallback to stub for any other case (preserves existing behavior)
  return "stub";
}

export const resolvedAuthMode = resolveAuthMode();
export const AUTH_ENABLED = resolvedAuthMode !== "stub";

// Export adapter implementations
import { ClerkAuthAdapter } from "./clerk-adapter";
import { StubAuthAdapter } from "./stub-adapter";
export { ClerkAuthAdapter, StubAuthAdapter };
export { AuthProvider, useAuthAdapter, useAuthUserMenu } from "./auth-provider";