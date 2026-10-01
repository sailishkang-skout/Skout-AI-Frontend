"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthAdapter, Session, GetAccessTokenOptions, User } from "./index";
import { logAndCapture, createClientLogger } from "@/lib/logger";
import { UserMenu as UserMenuCard } from "@/components/auth/user-menu";

const log = createClientLogger("custom-auth-adapter");

// Check if we're using custom auth mode (instead of Clerk)
export function isCustomAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === "custom";
}

// Broadcast channel for cross-tab communication
const BROADCAST_CHANNEL_NAME = "skout-auth-sync";
type BroadcastMessage =
  | { type: "TOKEN_REFRESHED"; accessToken: string; expiresAt: number }
  | { type: "SIGN_OUT" }
  | { type: "SESSION_REVOKED" };

// Token management state - FE-05 compliant (NO refresh token in JS memory)
let inMemoryAccessToken: string | null = null;
let csrfToken: string | null = null; // CSRF token from refresh/login responses (only this is safe to store in JS)
let tokenExpiresAt: number = 0;
let activeRefreshPromise: Promise<string | null> | null = null; // Single-flight lock
let broadcastChannel: BroadcastChannel | null = null;

// Refresh 30 seconds before token expires to be safe
const REFRESH_THRESHOLD_MS = 30 * 1000;
// Maximum time we'll wait for a refresh
const REFRESH_TIMEOUT_MS = 10 * 1000;

// User state
let currentUser: User | null = null;
let isSessionLoaded = false;

// FE-05's skout_app_csrf cookie (bff.ts CSRF_COOKIE) is deliberately JS-readable — it survives
// a cold page load even though the in-memory `csrfToken` above doesn't. Read it directly instead
// of relying on memory that a hard navigation (e.g. FE-10's Google OAuth redirect) always wipes.
const CSRF_COOKIE_NAME = "skout_app_csrf";

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Initialize broadcast channel
function initBroadcastChannel() {
  if (broadcastChannel) return;
  
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    
    broadcastChannel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data;
      
      switch (message.type) {
        case "TOKEN_REFRESHED":
          inMemoryAccessToken = message.accessToken;
          tokenExpiresAt = message.expiresAt;
          log.info("Received token update from another tab");
          break;
          
        case "SIGN_OUT":
        case "SESSION_REVOKED":
          clearAuthState();
          log.info("Received sign-out/ revocation from another tab, clearing state");
          break;
      }
    };
    
    log.info("Broadcast channel initialized for cross-tab auth sync");
  } catch (e) {
    log.warn("BroadcastChannel not supported, cross-tab sync disabled", { error: e });
  }
}

// Broadcast message to all tabs
function broadcast(message: BroadcastMessage) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
    } catch (e) {
      log.warn("Failed to broadcast message", { error: e });
    }
  }
}

// Clear all auth state
function clearAuthState() {
  inMemoryAccessToken = null;
  csrfToken = null;
  tokenExpiresAt = 0;
  activeRefreshPromise = null;
  currentUser = null;
  isSessionLoaded = false;
}

// Check if token is expired or about to expire
function isTokenExpired(): boolean {
  if (!inMemoryAccessToken || !tokenExpiresAt) return true;
  return Date.now() >= tokenExpiresAt - REFRESH_THRESHOLD_MS;
}

// FE-05 fully compliant performTokenRefresh()
async function performTokenRefresh(): Promise<string | null> {
  // If there's already an active refresh, return that promise (single-flight)
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  log.info("Starting token refresh");
  
  // Create new refresh promise
  activeRefreshPromise = (async () => {
    try {
      // FE-05 requirement: Call Next.js app route, not direct API_URL
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // In-memory csrfToken is wiped by a hard page load; fall back to the JS-readable cookie
      // (still valid — it's set with the same lifetime as the refresh cookie).
      const csrfForRequest = csrfToken ?? readCsrfCookie();
      if (csrfForRequest) {
        headers["x-csrf-token"] = csrfForRequest;
      }

      const response = await fetch("/app/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin", // Critical: sends skout_app_refresh HttpOnly cookie
        headers,
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Refresh token is invalid/expired, force sign out across all tabs
          log.warn("Refresh token rejected, signing out");
          clearAuthState();
          broadcast({ type: "SIGN_OUT" });
          return null;
        }
        throw new Error(`Refresh failed with status: ${response.status}`);
      }

      // FE-05's route handlers nest the payload under `data` (see sessionResponse in bff.ts):
      // { data: { accessToken, expiresIn, csrfToken } } — no `user` field.
      const body = (await response.json()) as { data?: { accessToken: string; expiresIn: number; csrfToken: string } };
      if (!body.data) throw new Error("Unexpected refresh response shape");

      // Update in-memory state only - refresh token stays in HttpOnly cookie (FE-05)
      inMemoryAccessToken = body.data.accessToken;
      csrfToken = body.data.csrfToken ?? csrfToken; // CSRF token rotates with every refresh
      tokenExpiresAt = Date.now() + body.data.expiresIn * 1000;

      // The refresh response carries no user claims (§3), same as login. Without this, a cold
      // page load (no prior client-side navigation to carry currentUser across, e.g. landing
      // back from an external redirect like FE-10's Google OAuth flow, or any hard reload) would
      // refresh a valid token forever while isSignedIn (token AND user) stayed stuck false. Only
      // fetch once — proactive refreshes every ~9.5 min shouldn't re-hit /session each time.
      if (!currentUser) {
        currentUser = await fetchCurrentUser();
        isSessionLoaded = true;
      }

      // Broadcast the new token to all tabs (only what's safe to share)
      if (inMemoryAccessToken) {
        broadcast({
          type: "TOKEN_REFRESHED",
          accessToken: inMemoryAccessToken,
          expiresAt: tokenExpiresAt,
        });
      }
      
      log.info("Token refresh successful");
      return inMemoryAccessToken;
    } catch (error) {
      logAndCapture(log, error as Error, "Failed to refresh token");
      clearAuthState();
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

// AUTH-FE-11: adopt a session already issued by another own-auth endpoint (e.g. invite
// verify-otp, which signs the user in via issueOwnAuthSession on the backend) without a
// second login round-trip. No refresh-cookie/CSRF handshake happened for this session, so
// refresh will fail once the access token expires — acceptable for the short invite flow,
// which only needs the user signed in long enough to land on the dashboard.
export function setCustomSession(session: { accessToken: string; expiresIn: number; user: User }) {
  initBroadcastChannel();
  inMemoryAccessToken = session.accessToken;
  tokenExpiresAt = Date.now() + session.expiresIn * 1000;
  currentUser = session.user;
  isSessionLoaded = true;

  broadcast({ type: "TOKEN_REFRESHED", accessToken: session.accessToken, expiresAt: tokenExpiresAt });
}

/** Thrown by customSignIn/customSignUp with the backend's §3 error code attached, so callers
 *  can render the right generic message (AUTH_INVALID_CREDENTIALS, AUTH_RATE_LIMITED, …). */
export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined,
    public readonly status: number
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

async function throwAuthApiError(response: Response): Promise<never> {
  const body = await response.json().catch(() => ({}) as { error?: string; code?: string });
  throw new AuthApiError(body.error ?? "Request failed", body.code, response.status);
}

/** GET /app/api/auth/session → the signed-in user's profile (never a token). AUTH-FE-08: the
 *  login BFF route only returns {accessToken, expiresIn, csrfToken} per §3 — no user claims are
 *  in the token, so the user profile has to be fetched separately after establishing a session. */
export async function fetchCurrentUser(): Promise<User | null> {
  const res = await fetch("/app/api/auth/session", { method: "GET", credentials: "same-origin" });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { userId: string; email: string; fullName?: string } };
  if (!body.data) return null;
  return { id: body.data.userId, email: body.data.email, name: body.data.fullName };
}

// Initial sign in (called from login page) - FE-05 compliant
type IssuedSession = { accessToken: string; expiresIn: number; csrfToken: string };

/** Adopts a session the BFF (FE-05) already established via Set-Cookie — shared by every flow
 *  that signs the user in through a `sessionResponse()` route (login, FE-09's verify-email
 *  confirm and otp/verify): store the safe values in memory, fetch the profile (§3 carries no
 *  user claims), and broadcast to other tabs. */
async function adoptSession(session: IssuedSession): Promise<void> {
  initBroadcastChannel();
  inMemoryAccessToken = session.accessToken;
  csrfToken = session.csrfToken;
  tokenExpiresAt = Date.now() + session.expiresIn * 1000;
  currentUser = await fetchCurrentUser();
  isSessionLoaded = true;
  broadcast({ type: "TOKEN_REFRESHED", accessToken: session.accessToken, expiresAt: tokenExpiresAt });
}

/** POSTs a §3 auth route through the BFF and adopts the session it establishes. Used by every
 *  own-auth flow that ends in a normal login-equivalent session (login itself, FE-09's
 *  verify-email confirm and otp/verify) so the response parsing and session bookkeeping live in
 *  one place. */
async function signInViaBff(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin", // Required to receive and store the HttpOnly cookie
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwAuthApiError(response);

  const data = (await response.json()) as { data?: IssuedSession };
  if (!data.data) throw new AuthApiError("Unexpected response from auth API", undefined, 502);
  await adoptSession(data.data);
}

export function customSignIn(credentials: { email: string; password: string } | { accessToken: string; expiresIn: number; user: User }): Promise<void> {
  // If we're passing an existing session (from OTP verification), use setCustomSession
  if ("accessToken" in credentials) {
    setCustomSession(credentials);
    return Promise.resolve();
  }
  // Otherwise, do normal BFF sign in
  return signInViaBff("/app/api/auth/login", credentials);
}

/** FE-09: confirms an email-verification token; the BFF's verify-email route issues a normal
 *  own-auth session on success, exactly like login. */
export function confirmEmailVerification(token: string): Promise<void> {
  return signInViaBff("/app/api/auth/verify-email", { token });
}

/** FE-09: verifies an email-OTP code (also the Clerk magic-link users' "email me a code" path);
 *  the BFF's otp-verify route issues a normal own-auth session on success, exactly like login. */
export function verifyEmailOtp(credentials: { email: string; code: string }): Promise<void> {
  return signInViaBff("/app/api/auth/otp-verify", credentials);
}

// Custom auth adapter implementation
export const CustomAuthAdapter: AuthAdapter = {
  useSession(): Session {
    const [, forceUpdate] = useState({});
    const isLoadedRef = useRef(isSessionLoaded);
    const isSignedInRef = useRef<boolean>(!!inMemoryAccessToken && !!currentUser);
    
    useEffect(() => {
      initBroadcastChannel();

      // If we have tokens but session isn't marked as loaded, mark it as loaded
      if (inMemoryAccessToken && currentUser && !isSessionLoaded) {
        isSessionLoaded = true;
      }

      // Cold page load (hard navigation, e.g. landing back from FE-10's Google OAuth
      // redirect): the access token lives in JS memory only, so it's gone, but the refresh
      // cookie survived. Without this, isSessionLoaded/isSignedIn would stay false forever —
      // nothing else ever calls performTokenRefresh() on mount. Single-flight-guarded, so a
      // second mounted consumer won't double-fire it.
      if (!isSessionLoaded && !inMemoryAccessToken) {
        void performTokenRefresh();
      }

      // Listen for changes that should trigger re-renders
      const checkForChanges = () => {
        const currentIsSignedIn = !!inMemoryAccessToken && !!currentUser;
        if (isLoadedRef.current !== isSessionLoaded || isSignedInRef.current !== currentIsSignedIn) {
          isLoadedRef.current = isSessionLoaded;
          isSignedInRef.current = currentIsSignedIn;
          forceUpdate({});
        }
      };
      
      // Check for changes periodically
      const interval = setInterval(checkForChanges, 100);
      
      return () => clearInterval(interval);
    }, []);

    return {
      isLoaded: isSessionLoaded,
      isSignedIn: !!inMemoryAccessToken && !!currentUser,
      user: currentUser,
    };
  },

  useGetAccessToken() {
    const getAccessToken = useCallback(async (options?: GetAccessTokenOptions): Promise<string | null> => {
      initBroadcastChannel();
      
      // If we need to force refresh or token is expired, refresh it
      if (options?.forceRefresh || isTokenExpired()) {
        return performTokenRefresh();
      }
      
      // Return current valid token
      return inMemoryAccessToken;
    }, []);

    return getAccessToken;
  },

  useSignOut() {
    const signOut = useCallback(async (): Promise<void> => {
      try {
        // Revoke session server-side using FE-05's route handler
        // Refresh cookie is sent automatically, server clears it on revoke
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        const csrfForRequest = csrfToken ?? readCsrfCookie();
        if (csrfForRequest) {
          headers["x-csrf-token"] = csrfForRequest;
        }
        if (inMemoryAccessToken) {
          headers["Authorization"] = `Bearer ${inMemoryAccessToken}`;
        }

        await fetch("/app/api/auth/logout", {
          method: "POST",
          credentials: "same-origin", // Automatically sends refresh cookie to be cleared
          headers,
        }).catch(e => log.warn("Failed to revoke token on server", e));
      } finally {
        // Clear local state regardless of server response
        clearAuthState();
        // Notify all other tabs
        broadcast({ type: "SIGN_OUT" });
        // Redirect to sign in page (skip in JSDOM test environment)
        if (typeof window !== 'undefined' && !window.navigator.userAgent.includes('jsdom')) {
          window.location.href = "/app/sign-in";
        }
      }
    }, []);

    return signOut;
  },

  UserMenu: () => {
    const { useSignOut, useSession } = CustomAuthAdapter;
    const signOut = useSignOut();
    const session = useSession();

    if (!session.isSignedIn || !session.user) return null;

    return <UserMenuCard user={session.user} onSignOut={() => void signOut()} />;
  },
};

// Handle AUTH_SESSION_REVOKED error from API calls
export function handleSessionRevoked() {
  log.warn("Session revoked, signing out");
  clearAuthState();
  broadcast({ type: "SESSION_REVOKED" });
  window.location.href = "/app/sign-in";
}