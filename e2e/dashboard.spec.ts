import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

test.describe("Dashboard", () => {
  test("shows workspace stats and quick actions", async ({ page }) => {
    await gotoAppPage(page, "/dashboard", "page-dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("quick-action-search")).toBeVisible();
    await expect(page.getByTestId("quick-action-lists")).toBeVisible();
  });

  test("navigates to prospect search from quick action", async ({ page }) => {
    await gotoAppPage(page, "/dashboard", "page-dashboard");
    await page.getByTestId("quick-action-search").click();
    await expect(page).toHaveURL(/\/prospects\/search/);
    await expect(page.getByTestId("page-prospect-search")).toBeVisible({ timeout: 15_000 });
  });
});
