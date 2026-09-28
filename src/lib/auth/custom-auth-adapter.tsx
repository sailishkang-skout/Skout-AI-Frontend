"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthAdapter, Session, GetAccessTokenOptions, User } from "./index";
import { logAndCapture, createClientLogger } from "@/lib/logger";

const log = createClientLogger("custom-auth-adapter");

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
      
      // Add CSRF token if we have one (required for FE-05's route handler)
      if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
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

      const data = await response.json();
      
      // Update in-memory state only - refresh token stays in HttpOnly cookie (FE-05)
      inMemoryAccessToken = data.accessToken;
      csrfToken = data.csrfToken ?? csrfToken; // Update CSRF token if rotated
      tokenExpiresAt = Date.now() + data.expiresIn * 1000;
      
      // Update user if provided
      if (data.user) {
        currentUser = data.user;
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

// Initial sign in (called from login page) - FE-05 compliant
export async function customSignIn(credentials: { email: string; password: string }) {
  initBroadcastChannel();
  
  // Use Next.js auth route handler which sets HttpOnly refresh cookie (FE-05)
  const response = await fetch("/app/api/auth/login", {
    method: "POST",
    credentials: "same-origin", // Required to receive and store the HttpOnly cookie
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  const data = await response.json();
  
  // Only store safe values in JS memory - refresh token stays in HttpOnly cookie
  inMemoryAccessToken = data.accessToken;
  csrfToken = data.csrfToken; // Store CSRF token for future refresh requests
  tokenExpiresAt = Date.now() + data.expiresIn * 1000;
  currentUser = data.user;
  isSessionLoaded = true;
  
  // Broadcast initial token to other tabs (only what's safe to share)
  if (inMemoryAccessToken) {
    broadcast({
      type: "TOKEN_REFRESHED",
      accessToken: inMemoryAccessToken,
      expiresAt: tokenExpiresAt,
    });
  }
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
        
        if (csrfToken) {
          headers["x-csrf-token"] = csrfToken;
        }
        if (inMemoryAccessToken) {
          headers["Authorization"] = `Bearer ${inMemoryAccessToken}`;
        }

        await fetch("/app/api/auth/revoke", {
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
          window.location.href = "/sign-in";
        }
      }
    }, []);

    return signOut;
  },

  // Simple user menu that calls sign out
  UserMenu: () => {
          const { useSignOut, useSession } = CustomAuthAdapter;
          const signOut = useSignOut();
          const session = useSession();
          
          if (!session.isSignedIn) return null;
          
          return (
            <div className="flex items-center gap-4">
              <span>{session.user?.email}</span>
              <button 
                onClick={signOut}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sign out
              </button>
            </div>
          );
        },
};

// Handle AUTH_SESSION_REVOKED error from API calls
export function handleSessionRevoked() {
  log.warn("Session revoked, signing out");
  clearAuthState();
  broadcast({ type: "SESSION_REVOKED" });
  window.location.href = "/sign-in";
}