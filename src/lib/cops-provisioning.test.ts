import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import {
  orderedSteps,
  PROVISIONING_STEPS,
  provisioningErrorMessage,
  provisioningFromError,
  stepProgress,
  trialDaysLeft,
  usageSeries,
  type ProvisioningStep,
} from "./cops-provisioning";

const step = (name: ProvisioningStep["step"], status: ProvisioningStep["status"]): ProvisioningStep => ({
  step: name,
  status,
  attempts: 1,
  error: null,
  duration_ms: 10,
  finished_at: null,
});

describe("cops-provisioning helpers", () => {
  it("orders steps as the saga runs them and fills missing ones as pending", () => {
    const steps = orderedSteps([step("admin_invite", "failed"), step("create_workspace", "succeeded")]);
    expect(steps.map((s) => s.step)).toEqual([...PROVISIONING_STEPS]);
    expect(steps[0]!.status).toBe("succeeded");
    expect(steps[5]!.status).toBe("failed");
    expect(steps[1]!.status).toBe("pending");
  });

  it("counts progress from succeeded steps only", () => {
    expect(stepProgress(undefined)).toEqual({ done: 0, total: 7, pct: 0 });
    expect(stepProgress(PROVISIONING_STEPS.map((s) => step(s, "succeeded")))).toEqual({ done: 7, total: 7, pct: 100 });
  });

  it("trial days left never goes negative", () => {
    const now = new Date("2026-10-08T00:00:00Z");
    expect(trialDaysLeft("2026-10-15T00:00:00Z", now)).toBe(7);
    expect(trialDaysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBeNull();
  });

  it("usage series covers 30 days ending today, zero-filled", () => {
    const now = new Date("2026-10-08T10:00:00Z");
    const series = usageSeries([{ day: "2026-10-08", consumed: 12 }, { day: "2026-09-20", consumed: 3 }], now);
    expect(series).toHaveLength(30);
    expect(series[0]!.date).toBe("2026-09-09");
    expect(series[29]).toEqual({ date: "2026-10-08", value: 12 });
    expect(series.find((p) => p.date === "2026-09-20")!.value).toBe(3);
    expect(series.filter((p) => p.value === 0)).toHaveLength(28);
  });

  it("reads the per-step status out of a failed (502) provisioning response", () => {
    const body = {
      code: "PROVISIONING_STEP_FAILED",
      message: "admin_invite: smtp",
      request_id: "r",
      retryable: true,
      data: { id: "p1", status: "failed", steps: [step("admin_invite", "failed")] },
    };
    const err = new CopsRequestError(body.message, { ...body, details: undefined }, new ApiError("fail", 502, body));
    expect(provisioningFromError(err)?.id).toBe("p1");
    expect(provisioningFromError(new Error("x"))).toBeNull();
  });

  it("explains the COPS-04 error codes in plain language", () => {
    const env = (code: string) => new CopsRequestError(code, { code, message: code, request_id: "r", retryable: false }, null);
    expect(provisioningErrorMessage(env("GATE_CLOSED"), "x")).toMatch(/commercial gate/);
    expect(provisioningErrorMessage(env("ALREADY_PROVISIONED"), "x")).toMatch(/already has/);
    expect(provisioningErrorMessage(env("INSUFFICIENT_CREDITS"), "x")).toMatch(/below zero/);
    expect(provisioningErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});
