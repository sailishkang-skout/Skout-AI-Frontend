// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { push, customSignIn } = vi.hoisted(() => ({
  push: vi.fn(),
  customSignIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth/custom-auth-adapter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/custom-auth-adapter")>(
    "@/lib/auth/custom-auth-adapter"
  );
  return { ...actual, customSignIn };
});

import { OwnAuthLoginForm } from "./own-auth-login-form";
import { AuthApiError } from "@/lib/auth/custom-auth-adapter";

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OwnAuthLoginForm />
    </QueryClientProvider>
  );
}

async function goToPasswordStep(email = "user@example.com") {
  renderForm();
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await screen.findByLabelText(/^password$/i);
}

describe("OwnAuthLoginForm (AUTH-FE-08)", () => {
  beforeEach(() => {
    push.mockClear();
    customSignIn.mockClear();
  });
  afterEach(cleanup);

  it("is identifier-first: password field only appears after continuing with an email", async () => {
    await goToPasswordStep();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
  });

  it("on success, hands off to /auth/callback for the onboarding/dashboard decision", async () => {
    customSignIn.mockResolvedValue(undefined);
    await goToPasswordStep();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "correct horse battery" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(customSignIn).toHaveBeenCalledWith({ email: "user@example.com", password: "correct horse battery" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/callback"));
  });

  it("shows the same generic message for invalid credentials as any other login failure", async () => {
    customSignIn.mockRejectedValue(new AuthApiError("Invalid email or password", "AUTH_INVALID_CREDENTIALS", 401));
    await goToPasswordStep();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/invalid email or password/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a rate-limit specific message on AUTH_RATE_LIMITED", async () => {
    customSignIn.mockRejectedValue(new AuthApiError("Too many requests", "AUTH_RATE_LIMITED", 429));
    await goToPasswordStep();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "correct horse battery" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/too many attempts/i);
  });
});
