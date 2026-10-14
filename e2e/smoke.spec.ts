import { test, expect } from "@playwright/test";
import { waitForApiHealth } from "./helpers";

test.describe("Public pages", () => {
  test("signin page loads", async ({ page }) => {
    // An absolute path leaves the /app base, so name it in full.
    await page.goto("/app/sign-in");
    await expect(page.getByRole("heading", { name: /sign in to skout/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
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
