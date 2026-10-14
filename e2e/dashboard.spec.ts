import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

test.describe("Dashboard", () => {
  test("shows workspace stats and quick actions", async ({ page }) => {
    await gotoAppPage(page, "/dashboard", "page-dashboard");
    // The dashboard is now the GTM Command Center; the old quick-action tiles are gone.
    await expect(page.getByRole("heading", { name: "GTM Command Center" })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("navigates to prospect search from the sidebar", async ({ page }) => {
    await gotoAppPage(page, "/dashboard", "page-dashboard");
    await page.getByRole("link", { name: "Search & Discover", exact: true }).click();
    await expect(page).toHaveURL(/\/prospects\/search/, { timeout: 30_000 });
    await expect(page.getByTestId("page-prospect-search")).toBeVisible({ timeout: 15_000 });
  });
});