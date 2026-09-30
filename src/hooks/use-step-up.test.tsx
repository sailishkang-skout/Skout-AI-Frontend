// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-client";
import { AuthProvider } from "@/lib/auth";

const { reauthenticate } = vi.hoisted(() => ({ reauthenticate: vi.fn() }));

vi.mock("@/lib/step-up", async () => {
  const actual = await vi.importActual<typeof import("@/lib/step-up")>("@/lib/step-up");
  return {
    ...actual,
    useStepUpApi: () => ({ reauthenticate }),
  };
});

import { useStepUp } from "./use-step-up";

function stepUpRequiredError() {
  return new ApiError("step_up_required", 401, { error: "step_up_required" });
}

/** Renders the hook wired to real DOM, exposing withStepUp via a button the test drives so
 *  the modal's own state updates re-render normally (unlike calling renderHook + a one-off
 *  render() of its stale output). */
function Harness({ action, onSettle }: { action: () => Promise<unknown>; onSettle: (v: unknown) => void }) {
  const { withStepUp, stepUpModal } = useStepUp();
  return (
    <div>
      <button onClick={() => withStepUp(action).then(onSettle, (e) => onSettle(e))}>Run</button>
      {stepUpModal}
    </div>
  );
}

function renderHarness(props: { action: () => Promise<unknown>; onSettle: (v: unknown) => void }) {
  return render(
    <AuthProvider>
      <Harness {...props} />
    </AuthProvider>
  );
}

describe("useStepUp (AUTH-FE-12)", () => {
  afterEach(() => {
    cleanup();
    reauthenticate.mockReset();
  });

  it("runs the action once and returns its result when no step-up is needed", async () => {
    const action = vi.fn().mockResolvedValue("ok");
    const onSettle = vi.fn();
    renderHarness({ action, onSettle });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(onSettle).toHaveBeenCalledWith("ok"));
    expect(action).toHaveBeenCalledTimes(1);
    expect(reauthenticate).not.toHaveBeenCalled();
  });

  it("prompts for a password, then retries the action once with the reauth token", async () => {
    reauthenticate.mockResolvedValue("user1.123.deadbeef");
    const action = vi.fn().mockRejectedValueOnce(stepUpRequiredError()).mockResolvedValueOnce("done");
    const onSettle = vi.fn();
    renderHarness({ action, onSettle });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    const passwordInput = await screen.findByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: "correct-horse-battery" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action).toHaveBeenNthCalledWith(2, "user1.123.deadbeef");
    await waitFor(() => expect(onSettle).toHaveBeenCalledWith("done"));
  });

  it("cancelling the modal rejects withStepUp without ever retrying the action", async () => {
    const action = vi.fn().mockRejectedValueOnce(stepUpRequiredError());
    const onSettle = vi.fn();
    renderHarness({ action, onSettle });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await screen.findByRole("button", { name: /cancel/i });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(onSettle).toHaveBeenCalled());
    expect(onSettle.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(action).toHaveBeenCalledTimes(1);
    expect(reauthenticate).not.toHaveBeenCalled();
  });
});
