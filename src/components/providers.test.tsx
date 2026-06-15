import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvisioner } from "./providers";

// --- module mocks (must be at top-level) ---

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

// --- imports after mocks so they get the mocked versions ---
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

const mockUseAuth = vi.mocked(useAuth);
const mockUseRouter = vi.mocked(useRouter);
const mockApiFetch = vi.mocked(apiFetch);

const push = vi.fn();

beforeEach(() => {
  push.mockReset();
  mockApiFetch.mockReset();
  mockUseRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("UserProvisioner", () => {
  it("does nothing when user is not signed in", async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, getToken: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<UserProvisioner />);
    // wait a tick to confirm no side effects happen
    await new Promise((r) => setTimeout(r, 10));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing when getToken returns null", async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof useAuth>);
    render(<UserProvisioner />);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing when /api/v1/me returns null (backend down)", async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok_test"),
    } as unknown as ReturnType<typeof useAuth>);
    mockApiFetch.mockRejectedValueOnce(new Error("network error")); // /me throws
    render(<UserProvisioner />);
    await new Promise((r) => setTimeout(r, 10));
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to /onboarding/icp when ICP data is null", async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok_test"),
    } as unknown as ReturnType<typeof useAuth>);
    mockApiFetch
      .mockResolvedValueOnce({ userId: "u1" })           // /api/v1/me
      .mockResolvedValueOnce({ data: null });             // /api/v1/icp

    render(<UserProvisioner />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/onboarding/icp");
    });
  });

  it("does not redirect when ICP data exists", async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok_test"),
    } as unknown as ReturnType<typeof useAuth>);
    mockApiFetch
      .mockResolvedValueOnce({ userId: "u1" })
      .mockResolvedValueOnce({ data: { industries: ["SaaS"] } }); // ICP present

    render(<UserProvisioner />);
    await new Promise((r) => setTimeout(r, 50));
    expect(push).not.toHaveBeenCalled();
  });

  it("does not redirect when /api/v1/icp call itself fails", async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok_test"),
    } as unknown as ReturnType<typeof useAuth>);
    mockApiFetch
      .mockResolvedValueOnce({ userId: "u1" })
      .mockRejectedValueOnce(new Error("icp fetch failed"));

    render(<UserProvisioner />);
    await new Promise((r) => setTimeout(r, 50));
    expect(push).not.toHaveBeenCalled();
  });

  it("calls /api/v1/me and /api/v1/icp with the auth token", async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok_xyz"),
    } as unknown as ReturnType<typeof useAuth>);
    mockApiFetch
      .mockResolvedValueOnce({ userId: "u1" })
      .mockResolvedValueOnce({ data: { industries: ["SaaS"] } });

    render(<UserProvisioner />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/me", { authToken: "tok_xyz" });
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/icp", { authToken: "tok_xyz" });
    });
  });
});
