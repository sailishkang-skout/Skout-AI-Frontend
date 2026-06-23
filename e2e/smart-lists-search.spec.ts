import { test, expect } from "@playwright/test";

test.describe("Smart lists", () => {
  test("smart lists page loads", async ({ page }) => {
    await page.goto("/smart-lists");
    await expect(page.getByRole("heading", { name: /smart lists/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create smart list/i })).toBeVisible();
  });
});

test.describe("Prospect search", () => {
  test("search page loads with query input", async ({ page }) => {
    await page.goto("/prospects/search");
    await expect(page.getByTestId("page-prospect-search")).toBeVisible();
    await expect(page.getByPlaceholder(/VP Sales|fintech/i)).toBeVisible();
  });
});
