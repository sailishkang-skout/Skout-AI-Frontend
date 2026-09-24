import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { AuthAdapter, Session, GetAccessTokenOptions } from "./index";
import React from "react";

// Temporary UserMenu component for Clerk adapter - will be replaced in FE-13
function ClerkUserMenu() {
  return <UserButton afterSignOutUrl="/sign-in" />;
}

export const ClerkAuthAdapter: AuthAdapter = {
  useSession(): Session {
    const { isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    return {
      isLoaded,
      isSignedIn: !!isSignedIn,
      user: user
        ? {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress || "",
            name: user.fullName || undefined,
            imageUrl: user.imageUrl || undefined,
          }
        : null,
    };
  },

  useGetAccessToken() {
    const { getToken } = useAuth();
    return async (options?: GetAccessTokenOptions): Promise<string | null> => {
      return getToken({ skipCache: options?.forceRefresh });
    };
  },

  useSignOut() {
    const { signOut } = useAuth();
    return async (): Promise<void> => {
      await signOut({ redirectUrl: "/sign-in" });
    };
  },

  UserMenu: ClerkUserMenu,
};