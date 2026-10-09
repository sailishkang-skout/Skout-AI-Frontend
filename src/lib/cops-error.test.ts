import { describe, expect, it } from "vitest";
import { fieldErrorsByPath, parseCopsError, retryAfterMs, shouldRetry } from "./cops-error";

const base = { code: "VALIDATION_FAILED", message: "Invalid", request_id: "req_1", retryable: false };

describe("parseCopsError", () => {
  it("accepts a well-formed envelope", () => {
    expect(parseCopsError(base)).toEqual({ ...base, details: undefined });
  });

  it("rejects bodies missing required fields", () => {
    expect(parseCopsError({ message: "x" })).toBeNull();
    expect(parseCopsError(null)).toBeNull();
    expect(parseCopsError({ ...base, retryable: "yes" })).toBeNull();
  });
});

describe("fieldErrorsByPath", () => {
  it("maps each 422 field path to its first message", () => {
    const err = parseCopsError({
      ...base,
      details: {
        fields: [
          { path: "contacts[2].email", code: "invalid", message: "Bad email" },
          { path: "contacts[2].email", code: "invalid", message: "Second" },
          { path: "name", code: "required", message: "Name is required" },
        ],
      },
    })!;
    expect(fieldErrorsByPath(err)).toEqual({
      "contacts[2].email": "Bad email",
      name: "Name is required",
    });
  });

  it("returns an empty map when there are no field details", () => {
    expect(fieldErrorsByPath(parseCopsError(base)!)).toEqual({});
  });
});

describe("retryAfterMs", () => {
  it("converts retry_after_seconds to milliseconds", () => {
    const err = parseCopsError({ ...base, code: "RATE_LIMITED", details: { retry_after_seconds: 7 } })!;
    expect(retryAfterMs(err)).toBe(7_000);
  });

  it("returns null without retry metadata or with a negative value", () => {
    expect(retryAfterMs(parseCopsError(base)!)).toBeNull();
    expect(retryAfterMs(parseCopsError({ ...base, details: { retry_after_seconds: -1 } })!)).toBeNull();
  });
});

describe("shouldRetry", () => {
  it("retries only retryable errors within the attempt limit", () => {
    const retryable = parseCopsError({ ...base, retryable: true })!;
    expect(shouldRetry(retryable, 1)).toBe(true);
    expect(shouldRetry(retryable, 3)).toBe(false);
    expect(shouldRetry(parseCopsError(base)!, 1)).toBe(false);
  });
});
