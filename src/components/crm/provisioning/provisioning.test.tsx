import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProvisioningSteps } from "./provisioning-steps";
import { AmountReasonDialog } from "./amount-reason-dialog";

describe("ProvisioningSteps", () => {
  afterEach(() => cleanup());

  it("shows every saga step with its status and the failing step's error", () => {
    render(
      <ProvisioningSteps
        steps={[
          { step: "create_workspace", status: "succeeded", attempts: 1, error: null, duration_ms: 40, finished_at: null },
          { step: "default_roles", status: "failed", attempts: 2, error: "System roles missing", duration_ms: 5, finished_at: null },
        ]}
      />
    );
    expect(screen.getByTestId("step-create_workspace").dataset.status).toBe("succeeded");
    expect(screen.getByTestId("step-default_roles").dataset.status).toBe("failed");
    expect(screen.getByTestId("step-link_crm").dataset.status).toBe("pending");
    screen.getByText("System roles missing");
    screen.getByText(/1 of 7 steps done/);
    screen.getByText(/2 tries/);
  });

  it("marks the next pending step as running while a request is in flight", () => {
    render(<ProvisioningSteps steps={[]} running />);
    expect(screen.getByTestId("step-create_workspace").dataset.status).toBe("running");
  });
});

describe("AmountReasonDialog", () => {
  afterEach(() => cleanup());

  it("needs a reason before it can submit, and sends a removal as a negative amount", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AmountReasonDialog open onClose={() => {}} mode="adjust" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "remove" } });
    fireEvent.change(screen.getByLabelText("Credits"), { target: { value: "25" } });
    const confirm = screen.getByRole("button", { name: /post adjustment/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Clawback of duplicate grant" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ amount: -25, reason: "Clawback of duplicate grant" });
    expect(onSubmit.mock.calls[0]![0].key).toMatch(/^web-/);
  });

  it("keeps one idempotency key while the dialog stays open (a double submit applies once)", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined);
    render(<AmountReasonDialog open onClose={() => {}} mode="grant" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Credits"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Pilot goodwill" } });
    const confirm = screen.getByRole("button", { name: /add credits/i });
    fireEvent.click(confirm);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]![0].key).toBe(onSubmit.mock.calls[0]![0].key);
  });
});
