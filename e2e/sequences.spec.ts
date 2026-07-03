import { test, expect } from "@playwright/test";

test.describe("Sequences", () => {
  test("list page loads and can create a sequence", async ({ page }) => {
    await page.goto("/sequences");
    await expect(page.getByTestId("page-sequences")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sequences" })).toBeVisible();

    const name = `E2E Sequence ${Date.now()}`;
    await page.getByPlaceholder(/SaaS VP outreach/i).fill(name);
    await page.getByRole("button", { name: /create sequence/i }).click();

    await expect(page.getByRole("link", { name, exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test("builder: add a step, edit delay, switch tabs", async ({ page }) => {
    await page.goto("/sequences");
    const name = `E2E Builder ${Date.now()}`;
    await page.getByPlaceholder(/SaaS VP outreach/i).fill(name);
    await page.getByRole("button", { name: /create sequence/i }).click();

    const link = page.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await page.waitForURL(/\/sequences\/[0-9a-f-]+$/, { timeout: 10_000 });

    await expect(page.locator("h1")).toHaveText(name);

    // Builder tab — add a step
    await page.getByRole("button", { name: "Add step" }).click();
    await expect(page.locator('input[aria-label="Delay in days"]')).toBeVisible({ timeout: 10_000 });

    // Enroll tab
    await page.getByRole("button", { name: "Enroll", exact: true }).click();
    await expect(page.getByText("Activate this sequence before enrolling prospects.")).toBeVisible();

    // Analytics tab
    await page.getByRole("button", { name: "Analytics", exact: true }).click();
    await expect(page.getByText("Total enrolled")).toBeVisible({ timeout: 10_000 });
  });
});
