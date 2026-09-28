// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api-client", () => ({ getApiBase: () => "http://api.test" }));

import { OwnAuthSignupForm } from "./own-auth-signup-form";

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OwnAuthSignupForm />
    </QueryClientProvider>
  );
}

function fillForm() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "correct horse battery staple" } });
}

describe("OwnAuthSignupForm (AUTH-FE-08)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(cleanup);

  it("shows a check-your-email state after a successful signup", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ data: { userId: "u1" } }) });
    renderForm();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByText(/check your email/i);
    expect(screen.getByText(/jane@example.com/)).toBeTruthy();
    expect((global.fetch as any).mock.calls[0][0]).toBe("http://api.test/api/v1/auth/signup");
  });

  it("shows the backend's error message and stays on the form when signup fails", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: "Email already in use" }) });
    renderForm();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/email already in use/i);
    expect(screen.queryByText(/check your email/i)).toBeNull();
  });

  it("disables submit until the password meets the minimum length", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "short" } });
    const btn = screen.getByRole("button", { name: /create account/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
