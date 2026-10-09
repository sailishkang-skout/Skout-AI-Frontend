import { describe, expect, it } from "vitest";
import { e2eAuthBypass } from "./middleware";

describe("e2eAuthBypass", () => {
  it("is on only for a non-production server started with E2E_AUTH_BYPASS=true", () => {
    expect(e2eAuthBypass({ E2E_AUTH_BYPASS: "true", NODE_ENV: "development" })).toBe(true);
    expect(e2eAuthBypass({ E2E_AUTH_BYPASS: "true", NODE_ENV: "test" })).toBe(true);
  });

  it("never opens a production build, even if the flag leaks into its env", () => {
    expect(e2eAuthBypass({ E2E_AUTH_BYPASS: "true", NODE_ENV: "production" })).toBe(false);
    expect(e2eAuthBypass({ NODE_ENV: "development" })).toBe(false);
    expect(e2eAuthBypass({ E2E_AUTH_BYPASS: "1", NODE_ENV: "development" })).toBe(false);
  });
});
