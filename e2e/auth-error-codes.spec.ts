import { test, expect } from "@playwright/test";

/**
 * AUTH-FE-02 / BE-08 — backend contract: protected routes return stable `code` on 401.
 * Requires API at PLAYWRIGHT_API_URL (see e2e/global-setup.ts).
 */
test.describe("API auth error codes (backend contract)", () => {
  test("missing bearer returns AUTH_MISSING_TOKEN when BE-08 is deployed", async ({
    request,
  }) => {
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";
    const res = await request.get(`${apiURL}/api/v1/workspaces/current`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    if (body.code) {
      expect(body.code).toBe("AUTH_MISSING_TOKEN");
    } else {
      test.info().annotations.push({
        type: "note",
        description:
          "Backend has not shipped BE-08 `code` yet — FE falls back to message matching.",
      });
      expect(String(body.error)).toMatch(/missing bearer token/i);
    }
  });
});
