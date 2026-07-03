import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page
        .getByRole("heading", { name: /clerk is not configured/i })
        .or(page.locator(".cl-rootBox"))
        .or(page.getByRole("button", { name: /continue with|sign in with/i }))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("home redirects to dashboard when auth bypass enabled", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("API health", () => {
  test("backend health endpoint responds", async ({ request }) => {
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";
    const res = await request.get(`${apiURL}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", service: "skout-api" });
  });
});
