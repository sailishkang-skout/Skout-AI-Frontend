import { vi } from "vitest";

const mockAuth = () => ({
  isLoaded: true,
  isSignedIn: true,
  userId: "test-user-id",
  sessionId: "test-session-id",
  getToken: async () => "test-token",
});

const mockUser = () => ({
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: "test-user-id",
    primaryEmailAddress: { emailAddress: "test@example.com" },
    fullName: "Test User",
  },
});

vi.mock("@clerk/nextjs", () => ({
  useAuth: mockAuth,
  useUser: mockUser,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: mockAuth,
  useUser: mockUser,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));
