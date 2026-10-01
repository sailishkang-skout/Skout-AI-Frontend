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
// Auth mode configuration — Clerk removed (AUTH-FE-18); custom auth is the only live mode
// besides the dev/E2E "stub" bypass.
export type AuthMode = "custom" | "stub";

const E2E_AUTH_BYPASS = process.env.E2E_AUTH_BYPASS === "true";

// Calculate which adapter to use - preserves existing behavior by default
export function resolveAuthMode(): AuthMode {
  // If we're in a test environment (vitest is running or NODE_ENV=test), always use stub
  const isTestEnvironment = typeof (globalThis as any).vitest !== "undefined" || process.env.NODE_ENV === "test";
  if (isTestEnvironment) {
    return "stub";
  }

  // If E2E auth bypass is enabled, always use stub
  if (E2E_AUTH_BYPASS) {
    return "stub";
  }

  // Fallback to stub for any other case (preserves existing behavior)
  return "custom";
}

export const resolvedAuthMode = resolveAuthMode();
export const AUTH_ENABLED = resolvedAuthMode !== "stub";

// Export adapter implementations
import { StubAuthAdapter } from "./stub-adapter";
import { CustomAuthAdapter } from "./custom-auth-adapter";
export { StubAuthAdapter, CustomAuthAdapter };
export { AuthProvider, useAuthAdapter, useAuthUserMenu } from "./auth-provider";