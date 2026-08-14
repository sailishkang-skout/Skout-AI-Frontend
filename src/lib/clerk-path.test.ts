import { describe, expect, it } from "vitest";
import { clerkCallbackPath, clerkPathFromLocation, SIGN_IN_MOUNTS, SIGN_UP_MOUNTS } from "./clerk-path";

describe("clerkPathFromLocation", () => {
  it("uses /app/signin when the marketing proxy hosts the app", () => {
    expect(clerkPathFromLocation("/app/signin", SIGN_IN_MOUNTS, "/signin")).toBe("/app/signin");
  });

  it("keeps /sign-in on the AWS origin", () => {
    expect(clerkPathFromLocation("/sign-in", SIGN_IN_MOUNTS, "/signin")).toBe("/sign-in");
  });

  it("keeps /signin on the AWS origin", () => {
    expect(clerkPathFromLocation("/signin", SIGN_IN_MOUNTS, "/signin")).toBe("/signin");
  });

  it("uses /app/sign-up behind the marketing host", () => {
    expect(clerkPathFromLocation("/app/sign-up", SIGN_UP_MOUNTS, "/sign-up")).toBe("/app/sign-up");
  });
});

describe("clerkCallbackPath", () => {
  it("always keeps the callback under /app", () => {
    expect(clerkCallbackPath("/app/signin")).toBe("/app/auth/callback");
    expect(clerkCallbackPath("/sign-in")).toBe("/app/auth/callback");
  });
});
