"use client";

import { useEffect } from "react";

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

/** Local dev / E2E stub mode — exposes a stub bridge for the Chrome extension. */
export function StubExtensionAuthSync() {
  useEffect(() => {
    window.__SKOUT_EXTENSION_BRIDGE__ = {
      ready: true,
      signedIn: true,
      getAuth: async () => ({ token: "stub", email: "dev@skout.local" }),
    };
    return () => {
      delete window.__SKOUT_EXTENSION_BRIDGE__;
    };
  }, []);

  return null;
}
