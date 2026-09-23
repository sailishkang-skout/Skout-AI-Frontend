import { describe, expect, it } from "vitest";
import { AuthErrorCode, parseAuthErrorCodeFromBody } from "./auth-error-codes";

describe("parseAuthErrorCodeFromBody", () => {
  it("reads top-level code from BE-08 body", () => {
    expect(
      parseAuthErrorCodeFromBody({
        error: "Invalid authorization token",
        code: AuthErrorCode.AUTH_TOKEN_INVALID,
      })
    ).toBe(AuthErrorCode.AUTH_TOKEN_INVALID);
  });

  it("reads nested error.code", () => {
    expect(
      parseAuthErrorCodeFromBody({
        error: { message: "x", code: AuthErrorCode.AUTH_TOKEN_EXPIRED },
      })
    ).toBe(AuthErrorCode.AUTH_TOKEN_EXPIRED);
  });
});
