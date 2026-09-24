import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { AuthAdapter } from "./index";
import { ClerkAuthAdapter } from "./clerk-adapter";
import { StubAuthAdapter } from "./stub-adapter";

// Shared contract tests that all auth adapters must pass
function runAuthAdapterContractTests(adapterName: string, adapter: AuthAdapter) {
  describe(`${adapterName} - AuthAdapter contract`, () => {
    it("implements all required methods", () => {
      // Check that all required methods exist
      expect(typeof adapter.useSession).toBe("function");
      expect(typeof adapter.useGetAccessToken).toBe("function");
      expect(typeof adapter.useSignOut).toBe("function");
    });

    it("useSession returns an object with correct shape", () => {
      const { result } = renderHook(() => adapter.useSession());
      const session = result.current;
      
      expect(session).toHaveProperty("isLoaded");
      expect(session).toHaveProperty("isSignedIn");
      expect(session).toHaveProperty("user");
      expect(typeof session.isLoaded).toBe("boolean");
      expect(typeof session.isSignedIn).toBe("boolean");
    });

    it("useGetAccessToken returns a function that returns a promise that resolves to string or null", async () => {
      const { result } = renderHook(() => adapter.useGetAccessToken());
      const getAccessToken = result.current;
      const token = await getAccessToken();
      expect(token === null || typeof token === "string").toBe(true);
    });

    it("useSignOut returns a function that returns a promise", async () => {
      const { result } = renderHook(() => adapter.useSignOut());
      const signOut = result.current;
      const promiseResult = signOut();
      expect(promiseResult instanceof Promise).toBe(true);
      await promiseResult; // Should not throw
    });
  });
}

// Run contract tests for all existing adapters
runAuthAdapterContractTests("StubAuthAdapter", StubAuthAdapter);
// Note: ClerkAuthAdapter can't be tested in isolation in unit tests because it depends on Clerk's Provider
// We'll skip the full contract tests for Clerk in unit tests since it requires the Clerk context to be set up
// But we still verify it implements the interface correctly
describe("ClerkAuthAdapter - interface check", () => {
  it("implements the AuthAdapter interface (type check only)", () => {
    // This is a type-only check that will fail at compile time if the interface isn't implemented
    const adapter: AuthAdapter = ClerkAuthAdapter;
    expect(adapter).toBeDefined();
  });
});