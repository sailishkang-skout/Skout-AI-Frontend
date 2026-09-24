import { test, expect } from "@playwright/test";

/**
 * E2E test for real token handling (no E2E_AUTH_BYPASS) - this test will exercise
 * the custom auth adapter's token generation and validation flow against
 * a locally running backend. Run with:
 * PLAYWRIGHT_REAL_TOKEN_TESTS=true pnpm playwright test --project=real-token-chromium
 */
test.describe("Real token authentication flow", () => {
  test("successfully obtains and passes access token to API", async ({ page }) => {
    // Navigate to the app (will trigger auth flow with custom adapter)
    await page.goto("/");

    // Verify we're signed in and can access protected routes
    await expect(page).toHaveURL(/.*dashboard/);

    // Verify that API requests include the valid auth token
    // Intercept API calls to verify token is present in Authorization header
    const apiRequestPromise = page.waitForRequest(
      (request) => request.url().includes("/api/") && request.method() === "GET"
    );

    // Trigger an API call by navigating to a protected page
    await page.getByText("Dashboard").click();
    const apiRequest = await apiRequestPromise;
    
    // Verify Authorization header is present and has a Bearer token
    const authHeader = apiRequest.headers().authorization;
    expect(authHeader).toBeDefined();
    expect(authHeader?.startsWith("Bearer ")).toBe(true);
    
    // Verify token is not the stub token (stub uses "stub-token")
    const token = authHeader?.split(" ")[1];
    expect(token).not.toBe("stub-token");
    expect(token?.length).toBeGreaterThan(20); // Real JWTs are long
  });

  test("successfully refreshes access token when expired", async ({ page }) => {
    // TODO: Implement token refresh test once custom auth adapter is complete
    test.skip(true, "Token refresh testing pending custom auth implementation");
  });

  test("handles signout correctly and invalidates tokens", async ({ page }) => {
    // TODO: Implement signout test once custom auth adapter is complete
    test.skip(true, "Signout testing pending custom auth implementation");
  });
});