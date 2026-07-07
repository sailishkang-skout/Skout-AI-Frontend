import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

test.describe("Smart lists", () => {
  test("smart lists page loads", async ({ page }) => {
    await gotoAppPage(page, "/smart-lists", "page-smart-lists");
    await expect(page.getByRole("heading", { name: "Smart lists", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /save smart list/i })).toBeVisible();
  });
});

test.describe("Prospect search", () => {
  test("search page loads with query input", async ({ page }) => {
    await gotoAppPage(page, "/prospects/search", "page-prospect-search");
    await expect(page.getByPlaceholder(/VP Sales|fintech/i)).toBeVisible();
  });
});
