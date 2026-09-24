"use client";

import { createContext, useContext, ReactNode } from "react";
import type { AuthAdapter } from "./index";
import { resolvedAuthMode, ClerkAuthAdapter, StubAuthAdapter } from "./index";

// Create the adapter based on resolved auth mode
function createAdapter(): AuthAdapter {
  switch (resolvedAuthMode) {
    case "clerk":
      return ClerkAuthAdapter;
    case "stub":
    default:
      return StubAuthAdapter;
  }
}

const AuthAdapterContext = createContext<AuthAdapter | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const adapter = createAdapter();
  
  return (
    <AuthAdapterContext.Provider value={adapter}>
      {children}
    </AuthAdapterContext.Provider>
  );
}

export function useAuthAdapter(): AuthAdapter {
  const context = useContext(AuthAdapterContext);
  if (!context) {
    throw new Error("useAuthAdapter must be used within an AuthProvider");
  }
  return context;
}

// Helper hook to access UserMenu from the adapter
export function useAuthUserMenu() {
  const adapter = useAuthAdapter();
  return adapter.UserMenu;
}