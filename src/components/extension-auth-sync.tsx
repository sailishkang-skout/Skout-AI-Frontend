"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef } from "react";
import {
  connectExtensionSeamless,
  pingExtensionPostMessage,
  rememberExtensionId,
} from "@/lib/extension-connect";

/** Minimum gap between extension syncs — protects Clerk's token endpoint from request storms. */
const SYNC_THROTTLE_MS = 20_000;
const SYNC_INTERVAL_MS = 5 * 60_000;

declare global {
  interface Window {
    __SKOUT_EXTENSION_BRIDGE__?: {
      ready: boolean;
      signedIn: boolean;
      getAuth: () => Promise<
        | { token: string; email: string }
        | { error: "not_signed_in" | "no_token" }
      >;
    };
  }
}

/** Invisible: keeps the extension signed in while the user uses Skout normally. */
export function ExtensionAuthSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const lastSyncedToken = useRef("");
  const lastSyncAt = useRef(0);
  const syncInFlight = useRef(false);

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";

  const getAuth = useCallback(async () => {
    if (!isSignedIn) return { error: "not_signed_in" as const };
    // Use Clerk's cached token. It auto-refreshes near expiry, so this almost never
    // hits the network — forcing skipCache here was spamming the token endpoint (429s).
    const token = await getToken();
    if (!token) return { error: "no_token" as const };
    return { token, email };
  }, [getToken, isSignedIn, email]);

  const syncToExtension = useCallback(
    async (force = false) => {
      if (!isLoaded || !isSignedIn) return;
      if (syncInFlight.current) return;

      const now = Date.now();
      if (!force && now - lastSyncAt.current < SYNC_THROTTLE_MS) return;
      lastSyncAt.current = now;
      syncInFlight.current = true;

      try {
        const auth = await getAuth();
        if ("error" in auth) return;

        // Same token already delivered — skip the connect/ping storm to avoid a
        // ping → REQUEST_AUTH → sync feedback loop.
        if (auth.token === lastSyncedToken.current) return;

        pingExtensionPostMessage();
        try {
          await connectExtensionSeamless(auth.token, auth.email);
          lastSyncedToken.current = auth.token;
        } catch {
          // Extension not installed.
        }
      } finally {
        syncInFlight.current = false;
      }
    },
    [getAuth, isLoaded, isSignedIn]
  );

  // Keep a stable reference to the latest sync/getAuth so the listener and interval
  // effects don't tear down and re-fire (re-fetching tokens) on every render.
  const syncRef = useRef(syncToExtension);
  const getAuthRef = useRef(getAuth);
  syncRef.current = syncToExtension;
  getAuthRef.current = getAuth;

  useEffect(() => {
    window.__SKOUT_EXTENSION_BRIDGE__ = {
      ready: isLoaded,
      signedIn: Boolean(isSignedIn),
      getAuth: () => getAuthRef.current(),
    };
    return () => {
      delete window.__SKOUT_EXTENSION_BRIDGE__;
    };
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    function onExtensionMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "skout-extension") return;
      if (event.data.type === "EXTENSION_INSTALLED" && event.data.extensionId) {
        rememberExtensionId(event.data.extensionId);
      }
      if (event.data.type === "REQUEST_AUTH") {
        void syncRef.current();
      }
    }

    window.addEventListener("message", onExtensionMessage);
    return () => window.removeEventListener("message", onExtensionMessage);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void syncRef.current(true);
    const interval = window.setInterval(() => void syncRef.current(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isLoaded, isSignedIn]);

  return null;
}
