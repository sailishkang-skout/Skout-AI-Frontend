import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  preview: vi.fn(),
  send: vi.fn(),
  action: vi.fn(),
}));
vi.mock("@/lib/cops-onboarding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cops-onboarding")>()),
  useCopsOnboardingApi: () => api,
}));

import { OnboardingEmailDialog } from "./onboarding-email-dialog";
import { FollowUpActionDialog } from "./follow-up-action-dialog";
import { ReasonDialog } from "./reason-dialog";
import type { EmailSend } from "@/lib/cops-onboarding";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const preview = (blocked: string | null = null) => ({
  data: { template_key: "welcome_trial", template_version: 1, to: "ada@c.test", subject: "Your trial is ready", html: "<p>Hi</p>", text: "Hi", blocked },
});
const sent: EmailSend = {
  id: "e1",
  account_id: "a1",
  contact_id: "c1",
  to: "ada@c.test",
  template_key: "welcome_trial",
  template_version: 1,
  subject: "Welcome",
  status: "sent",
  is_resend: false,
  reason: null,
  error: null,
  opened_at: null,
  clicked_at: null,
  sent_at: "2026-10-08T00:00:00Z",
  created_at: "2026-10-08T00:00:00Z",
};

describe("OnboardingEmailDialog", () => {
  beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
  afterEach(() => cleanup());

  it("previews the template and sends with one key per open dialog", async () => {
    api.preview.mockResolvedValue(preview());
    api.send.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ data: sent });
    const onSent = vi.fn();
    wrap(<OnboardingEmailDialog open onClose={() => {}} accountId="a1" previous={[]} onSent={onSent} />);
    await screen.findByText(/Your trial is ready/);
    expect(screen.getByTestId("onboarding-email-preview").getAttribute("sandbox")).toBe("");
    const button = screen.getByTestId("onboarding-email-send") as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(onSent).toHaveBeenCalledOnce());
    expect(api.send.mock.calls[1]![2]).toBe(api.send.mock.calls[0]![2]);
    expect(api.send.mock.calls[0]![1]).toEqual({});
  });

  it("will not send to a blocked contact and says why", async () => {
    api.preview.mockResolvedValue(preview("suppressed"));
    wrap(<OnboardingEmailDialog open onClose={() => {}} accountId="a1" previous={[]} onSent={() => {}} />);
    await screen.findByText(/unsubscribed or is blocked/);
    expect((screen.getByTestId("onboarding-email-send") as HTMLButtonElement).disabled).toBe(true);
  });

  it("a second send is a re-send that needs a reason", async () => {
    api.preview.mockResolvedValue(preview());
    api.send.mockResolvedValue({ data: { ...sent, is_resend: true } });
    wrap(<OnboardingEmailDialog open onClose={() => {}} accountId="a1" previous={[sent]} onSent={() => {}} />);
    await screen.findByText(/Your trial is ready/);
    const button = screen.getByTestId("onboarding-email-send") as HTMLButtonElement;
    expect(button.textContent).toMatch(/Re-send/);
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for re-sending"), { target: { value: "Customer lost it" } });
    fireEvent.click(button);
    await waitFor(() => expect(api.send).toHaveBeenCalledOnce());
    expect(api.send.mock.calls[0]![1]).toEqual({ resend: true, reason: "Customer lost it" });
  });
});

describe("FollowUpActionDialog", () => {
  beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
  afterEach(() => cleanup());

  it("a call needs an outcome and completes the queue item it came from", async () => {
    api.action.mockResolvedValue({ data: { activity_id: "act1" } });
    const onDone = vi.fn();
    wrap(<FollowUpActionDialog open onClose={() => {}} kind="call" accountId="a1" accountName="Acme" contact={{ id: "c1", name: "Ada", email: "ada@c.test" }} queueItemId="task:t1" onDone={onDone} />);
    const save = screen.getByTestId("follow-up-action-submit") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "Connected the CRM together" } });
    fireEvent.click(save);
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(api.action.mock.calls[0]![0]).toMatchObject({ kind: "call", account_id: "a1", contact_id: "c1", queue_item_id: "task:t1", outcome: "Connected the CRM together" });
  });

  it("an email needs a contact with an email address", () => {
    wrap(<FollowUpActionDialog open onClose={() => {}} kind="email" accountId="a1" accountName="Acme" contact={null} onDone={() => {}} />);
    screen.getByText(/no contact with an email address/);
    expect((screen.getByTestId("follow-up-action-submit") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ReasonDialog", () => {
  afterEach(() => cleanup());

  it("needs a reason and shows the server's message on failure", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("The follow-up already ended")).mockResolvedValue(undefined);
    render(<ReasonDialog open onClose={() => {}} title="Stop follow-up" description="d" confirm="Stop" onSubmit={onSubmit} danger />);
    const stop = screen.getByRole("button", { name: "Stop" }) as HTMLButtonElement;
    expect(stop.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Handled by phone" } });
    fireEvent.click(stop);
    await screen.findByText("The follow-up already ended");
    expect(onSubmit).toHaveBeenCalledWith("Handled by phone");
  });
});
