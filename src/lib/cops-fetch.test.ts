import { describe, expect, it, vi, beforeEach } from "vitest";

const apiFetchMock = vi.fn();
vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    constructor(message: string, public status: number, public body?: unknown) {
      super(message);
    }
  }
  return { apiFetch: (...a: unknown[]) => apiFetchMock(...a), ApiError };
});

import { ApiError } from "@/lib/api-client";
import { copsFetch, CopsRequestError } from "./cops-fetch";

const envelope = (over: Record<string, unknown>) => ({
  code: "RATE_LIMITED",
  message: "Slow down",
  request_id: "req_1",
  retryable: false,
  ...over,
});

describe("copsFetch", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("returns the data on success", async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: 1 });
    await expect(copsFetch("/api/v1/x")).resolves.toEqual({ ok: 1 });
  });

  it("retries a retryable 429 after the advertised delay", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    apiFetchMock
      .mockRejectedValueOnce(
        new ApiError("429", 429, envelope({ retryable: true, details: { retry_after_seconds: 3 } }))
      )
      .mockResolvedValueOnce({ ok: true });
    await expect(copsFetch("/api/v1/x", undefined, { sleep, maxAttempts: 2 })).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(3_000);
  });

  it("throws the envelope for a non-retryable error without retrying", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError("422", 422, envelope({ code: "VALIDATION_FAILED", message: "Bad", details: { fields: [] } }))
    );
    const err = (await copsFetch("/api/v1/x").catch((e) => e)) as CopsRequestError;
    expect(err).toBeInstanceOf(CopsRequestError);
    expect(err.envelope?.code).toBe("VALIDATION_FAILED");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt limit", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    apiFetchMock
      .mockRejectedValueOnce(new ApiError("503", 503, envelope({ retryable: true })))
      .mockRejectedValueOnce(new ApiError("503", 503, envelope({ retryable: true })));
    let thrown: unknown = null;
    try {
      await copsFetch("/api/v1/x", undefined, { sleep, maxAttempts: 2 });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(CopsRequestError);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("wraps a plain network error without an envelope", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    const err = (await copsFetch("/api/v1/x").catch((e) => e)) as CopsRequestError;
    expect(err.envelope).toBeNull();
    expect(err.message).toBe("offline");
  });
});
