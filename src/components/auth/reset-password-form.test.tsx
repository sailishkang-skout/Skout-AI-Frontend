// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { useSearchParamsMock, replaceStateMock } = vi.hoisted(() => ({
  useSearchParamsMock: vi.fn(),
  replaceStateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: useSearchParamsMock,
}));

import { ResetPasswordForm } from "./reset-password-form";

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ResetPasswordForm />
    </QueryClientProvider>
  );
}

describe("ResetPasswordForm (AUTH-FE-09)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    window.history.replaceState = replaceStateMock;
    replaceStateMock.mockClear();
  });
  afterEach(cleanup);

  it("strips the token from the URL on load — it must never linger in history or analytics", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("token=super-secret-reset-token"));
    renderForm();

    expect(replaceStateMock).toHaveBeenCalledTimes(1);
    // No query string in the replaced URL — the token is gone from what history/analytics sees.
    const [, , url] = replaceStateMock.mock.calls[0]!;
    expect(String(url)).not.toContain("super-secret-reset-token");
    expect(String(url)).not.toContain("?");

    // The form itself still renders normally — the token is kept in memory, not lost.
    expect(screen.getByLabelText(/new password/i)).toBeTruthy();
  });

  it("shows the invalid-link state and never touches history when there is no token", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    renderForm();

    expect(replaceStateMock).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid link/i)).toBeTruthy();
  });
});
