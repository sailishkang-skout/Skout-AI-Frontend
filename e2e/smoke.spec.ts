import { test, expect } from "@playwright/test";
import { waitForApiHealth } from "./helpers";

test.describe("Public pages", () => {
  test("sign-in page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .getByRole("heading", { name: /clerk is not configured/i })
        .or(page.locator(".cl-rootBox"))
        .or(page.getByRole("button", { name: /continue with|sign in with/i }))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("home redirects to dashboard when auth bypass enabled", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByTestId("page-dashboard")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("API health", () => {
  test("backend health endpoint responds", async ({ request }) => {
    await waitForApiHealth(request);
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";
    const body = await (await request.get(`${apiURL}/api/v1/health`)).json();
    expect(body).toMatchObject({ status: "ok", service: "skout-api" });
  });
});
