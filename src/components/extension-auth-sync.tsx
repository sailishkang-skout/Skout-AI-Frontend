"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef } from "react";
import {
  connectExtensionSeamless,
  pingExtensionPostMessage,
  rememberExtensionId,
} from "@/lib/extension-connect";

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

  const getAuth = useCallback(async () => {
    if (!isSignedIn) return { error: "not_signed_in" as const };
    const token = await getToken({ skipCache: true });
    if (!token) return { error: "no_token" as const };
    return {
      token,
      email: user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "",
    };
  }, [getToken, isSignedIn, user]);

  const syncToExtension = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    const auth = await getAuth();
    if ("error" in auth) return;

    pingExtensionPostMessage();

    try {
      await connectExtensionSeamless(auth.token, auth.email);
      lastSyncedToken.current = auth.token;
    } catch {
      // Extension not installed.
    }
  }, [getAuth, isLoaded, isSignedIn]);

  useEffect(() => {
    window.__SKOUT_EXTENSION_BRIDGE__ = {
      ready: isLoaded,
      signedIn: Boolean(isSignedIn),
      getAuth,
    };
    return () => {
      delete window.__SKOUT_EXTENSION_BRIDGE__;
    };
  }, [getAuth, isLoaded, isSignedIn]);

  useEffect(() => {
    function onExtensionMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "skout-extension") return;
      if (event.data.type === "EXTENSION_INSTALLED" && event.data.extensionId) {
        rememberExtensionId(event.data.extensionId);
      }
      if (event.data.type === "REQUEST_AUTH") {
        void syncToExtension();
      }
    }

    window.addEventListener("message", onExtensionMessage);
    return () => window.removeEventListener("message", onExtensionMessage);
  }, [syncToExtension]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void syncToExtension();
    const interval = window.setInterval(() => void syncToExtension(), 30_000);
    return () => window.clearInterval(interval);
  }, [isLoaded, isSignedIn, syncToExtension]);

  return null;
}
