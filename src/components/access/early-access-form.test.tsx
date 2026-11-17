import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import type { AccessState } from "@/lib/access";

const nav = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
}));

const api = vi.hoisted(() => ({ get: vi.fn(), submit: vi.fn(), redeem: vi.fn() }));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAccessApi: () => api,
}));

const signOut = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useAuthAdapter: () => ({ useSignOut: () => signOut }),
}));

import { EarlyAccessForm } from "./early-access-form";

const pending: AccessState = {
  status: "pending",
  features: {} as AccessState["features"],
  request: { company: null, role_title: null, use_case: null, submitted: false, created_at: "2026-11-17T00:00:00Z" },
};

function renderForm(state: AccessState = pending) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["access"], state);
  api.get.mockResolvedValue({ data: state });
  return render(
    <QueryClientProvider client={client}>
      <EarlyAccessForm />
    </QueryClientProvider>
  );
}

describe("EarlyAccessForm", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("requires company and role before saving", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(api.submit).not.toHaveBeenCalled();
    expect(await screen.findByText("Company and role are required.")).toBeTruthy();
  });

  it("submits company, role and use case", async () => {
    api.submit.mockResolvedValue({ data: pending });
    renderForm();
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Founder" } });
    fireEvent.change(screen.getByLabelText("What will you use Skout for?"), { target: { value: "Outbound" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() =>
      expect(api.submit).toHaveBeenCalledWith({ company: "Acme", role_title: "Founder", use_case: "Outbound" })
    );
  });

  it("pre-fills the code from the link", () => {
    nav.params = new URLSearchParams("code=ABCD-EFGH");
    renderForm();
    expect((screen.getByLabelText("Invite code") as HTMLInputElement).value).toBe("ABCD-EFGH");
  });

  it("explains an invalid code", async () => {
    api.redeem.mockRejectedValue(new ApiError("bad", 422, { code: "invalid_code" }));
    renderForm();
    fireEvent.change(screen.getByLabelText("Invite code"), { target: { value: "WRONG-CODE" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("That code isn't valid.")).toBeTruthy();
  });

  it("explains an expired code", async () => {
    api.redeem.mockRejectedValue(new ApiError("old", 422, { code: "expired_code" }));
    renderForm();
    fireEvent.change(screen.getByLabelText("Invite code"), { target: { value: "ABCD-EFGH" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("That code has expired — ask us to resend it.")).toBeTruthy();
  });

  it("goes to the dashboard after a successful redeem", async () => {
    api.redeem.mockResolvedValue({ data: { status: "active" } });
    renderForm();
    fireEvent.change(screen.getByLabelText("Invite code"), { target: { value: "ABCD-EFGH" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard"));
    expect(api.redeem).toHaveBeenCalledWith("ABCD-EFGH");
  });

  it("lets a waiting user sign out and use a different account", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Use a different account" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it("shows details saved earlier, even when they arrive after the page mounts", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["access"], pending);
    render(
      <QueryClientProvider client={client}>
        <EarlyAccessForm />
      </QueryClientProvider>
    );
    act(() => {
      client.setQueryData(["access"], { ...pending, request: { ...pending.request!, company: "Acme", role_title: "CTO", submitted: true } });
    });
    await waitFor(() => expect((screen.getByLabelText("Company") as HTMLInputElement).value).toBe("Acme"));
    expect((screen.getByLabelText("Role") as HTMLInputElement).value).toBe("CTO");
  });

  it("sends an already active workspace to the dashboard", async () => {
    renderForm({ ...pending, status: "active", request: null });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard"));
  });
});
