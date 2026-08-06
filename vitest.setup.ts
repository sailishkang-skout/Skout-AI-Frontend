import { vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "test-user-id",
    sessionId: "test-session-id",
    getToken: async () => "test-token",
  }),
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "test-user-id",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      fullName: "Test User",
    },
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));
