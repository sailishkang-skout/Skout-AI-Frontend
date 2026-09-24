import type { AuthAdapter, Session } from "./index";
import React from "react";

export const StubAuthAdapter: AuthAdapter = {
  useSession(): Session {
    // Stub always returns a loaded, signed-in session
    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: "stub-user-123",
        email: "stub@example.com",
        name: "Stub User",
      },
    };
  },

  useGetAccessToken() {
    return async (): Promise<string | null> => {
      // Stub doesn't need a real token - the API client will add x-stub-user-email header
      return "stub-token";
    };
  },

  useSignOut() {
    return async (): Promise<void> => {
      // Stub signout is a no-op for now
      console.log("Stub signOut called");
    };
  },

  // Stub doesn't render a UserButton since it's only used in development/testing
  UserMenu: () => null,
};