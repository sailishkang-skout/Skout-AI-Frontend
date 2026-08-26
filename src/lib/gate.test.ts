import { describe, expect, it } from "vitest";
import { isGatePath, safeNextPath } from "./gate";

describe("isGatePath", () => {
  it("matches the gate with and without basePath", () => {
    expect(isGatePath("/gate")).toBe(true);
    expect(isGatePath("/app/gate")).toBe(true);
    expect(isGatePath("/sign-in")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a short in-app path", () => {
    expect(safeNextPath("/sign-in")).toBe("/sign-in");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("strips basePath so redirect() does not double /app", () => {
    expect(safeNextPath("/app/sign-in")).toBe("/sign-in");
  });

  it("drops Clerk handshake query strings that cause HTTP 431", () => {
    expect(safeNextPath("/sign-in?__clerk_handshake=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.aaa")).toBe(
      "/sign-in",
    );
    expect(safeNextPath("/app/gate?__clerk_handshake=eyJhbGciOiJSUzI1NiJ9.aaa")).toBe("/sign-in");
  });

  it("does not bounce back onto the gate page", () => {
    expect(safeNextPath("/gate")).toBe("/sign-in");
    expect(safeNextPath("/app/gate")).toBe("/sign-in");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/sign-in");
    expect(safeNextPath("https://www.skoutai.io/app/dashboard")).toBe("/sign-in");
    expect(safeNextPath("//evil.example")).toBe("/sign-in");
  });
});
