// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "inv_test_token" }),
  useRouter: () => ({ push, replace }),
}));

vi.mock("@/lib/team", () => ({
  getInviteDetails: () =>
    Promise.resolve({
      workspaceName: "Acme",
      email: "invitee@example.com",
      accepted: false,
      expired: false,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }),
}));

vi.mock("@/lib/api-client", () => ({ getApiBase: () => "http://api.test" }));

const { authModeState, useSessionMock, setCustomSession } = vi.hoisted(() => ({
  authModeState: { mode: "stub" as "custom" | "stub" },
  useSessionMock: vi.fn(() => ({ isLoaded: true, isSignedIn: false, user: null })),
  setCustomSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  get resolvedAuthMode() {
    return authModeState.mode;
  },
  AUTH_ENABLED: true,
  useAuthAdapter: () => ({ useSession: useSessionMock }),
}));

vi.mock("@/lib/auth/custom-auth-adapter", () => ({ setCustomSession }));

import AcceptInvitePage from "./page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AcceptInvitePage />
    </QueryClientProvider>
  );
}

async function verifyOtpAndSetPassword() {
  await screen.findByText(/you're invited/i);
  fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));
  const otpInput = await screen.findByPlaceholderText(/enter 6-digit code/i);
  fireEvent.change(otpInput, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: /verify code/i }));
  const pwInput = await screen.findByPlaceholderText(/choose a password/i);
  fireEvent.change(pwInput, { target: { value: "correct horse battery" } });
  fireEvent.click(screen.getByRole("button", { name: /set password & join workspace/i }));
}

describe("AcceptInvitePage (AUTH-FE-11)", () => {
  const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

  beforeEach(() => {
    vi.restoreAllMocks();
    setItemSpy.mockClear();
    push.mockClear();
    replace.mockClear();
    setCustomSession.mockClear();
    authModeState.mode = "stub";

    global.fetch = vi.fn((url: string) => {
      if (url.endsWith("/invite-auth/send-otp")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { email: "invitee@example.com", expiresInMinutes: 10 } }),
        }) as any;
      }
      if (url.endsWith("/invite-auth/verify-otp")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              sessionToken: "isk_abc",
              workspaceId: "ws_1",
              role: "member",
              email: "invitee@example.com",
              ...(authModeState.mode === "custom"
                ? { accessToken: "eyJ.own-auth.token", expiresIn: 600, user: { id: "u1", email: "invitee@example.com" } }
                : {}),
            },
          }),
        }) as any;
      }
      if (url.endsWith("/invite-auth/set-password")) {
        return Promise.resolve({ ok: true, json: async () => ({}) }) as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as any;
  });

  afterEach(() => {
    cleanup();
  });

  it("never touches localStorage for the invite/session token, in either mode", async () => {
    authModeState.mode = "custom";
    renderPage();
    await verifyOtpAndSetPassword();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));

    for (const call of setItemSpy.mock.calls) {
      expect(call[0]).not.toMatch(/invite_session_token|session/i);
    }
  });

  it("custom mode: adopts the own-auth session from verify-otp and skips the second login", async () => {
    authModeState.mode = "custom";
    renderPage();
    await verifyOtpAndSetPassword();

    await waitFor(() =>
      expect(setCustomSession).toHaveBeenCalledWith({
        accessToken: "eyJ.own-auth.token",
        expiresIn: 600,
        user: { id: "u1", email: "invitee@example.com" },
      })
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText(/sign in to continue/i)).toBeNull();
  });

  it("stub mode: unchanged — still shows the 'sign in to continue' step, no session adopted", async () => {
    authModeState.mode = "stub";
    renderPage();
    await verifyOtpAndSetPassword();

    await screen.findByText(/account created/i);
    expect(screen.getByRole("button", { name: /sign in to continue/i })).toBeTruthy();
    expect(setCustomSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
