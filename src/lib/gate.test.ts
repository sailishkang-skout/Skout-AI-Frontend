import { describe, expect, it } from "vitest";
import { isGatePath, safeNextPath } from "./gate";

describe("isGatePath", () => {
  it("matches the gate with and without basePath", () => {
    expect(isGatePath("/gate")).toBe(true);
    expect(isGatePath("/app/gate")).toBe(true);
    expect(isGatePath("/signin")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a short in-app path", () => {
    expect(safeNextPath("/signin")).toBe("/signin");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("strips basePath so redirect() does not double /app", () => {
    expect(safeNextPath("/app/signin")).toBe("/signin");
  });

  it("drops Clerk handshake query strings that cause HTTP 431", () => {
    expect(safeNextPath("/signin?__clerk_handshake=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.aaa")).toBe(
      "/signin",
    );
    expect(safeNextPath("/app/gate?__clerk_handshake=eyJhbGciOiJSUzI1NiJ9.aaa")).toBe("/signin");
  });

  it("does not bounce back onto the gate page", () => {
    expect(safeNextPath("/gate")).toBe("/signin");
    expect(safeNextPath("/app/gate")).toBe("/signin");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/signin");
    expect(safeNextPath("https://www.skoutai.io/app/dashboard")).toBe("/signin");
    expect(safeNextPath("//evil.example")).toBe("/signin");
  });
});
