import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("shows workspace stats and quick actions", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("page-dashboard")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("quick-action-search")).toBeVisible();
    await expect(page.getByTestId("quick-action-lists")).toBeVisible();
  });

  test("navigates to prospect search from quick action", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("quick-action-search").click();
    await expect(page).toHaveURL(/\/prospects\/search/);
    await expect(page.getByTestId("page-prospect-search")).toBeVisible();
  });
});
