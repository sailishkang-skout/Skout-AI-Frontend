import { test, expect } from "@playwright/test";
import { gotoAppPage, waitForApiMutation } from "./helpers";

test.describe("Sequences", () => {
  test("list page loads and can create a sequence", async ({ page }) => {
    await gotoAppPage(page, "/sequences", "page-sequences");
    await expect(page.getByRole("heading", { name: "Sequences" })).toBeVisible();

    const name = `E2E Sequence ${Date.now()}`;
    await page.getByPlaceholder(/SaaS VP outreach/i).fill(name);
    await waitForApiMutation(page, "/api/v1/sequences", "POST", async () => {
      await page.getByRole("button", { name: /create sequence/i }).click();
    });

    await expect(page.locator(`[data-sequence-name="${name}"]`)).toBeVisible({ timeout: 15_000 });
  });

  test("builder: add a step, edit delay, switch tabs", async ({ page }) => {
    await gotoAppPage(page, "/sequences", "page-sequences");
    const name = `E2E Builder ${Date.now()}`;
    await page.getByPlaceholder(/SaaS VP outreach/i).fill(name);
    await waitForApiMutation(page, "/api/v1/sequences", "POST", async () => {
      await page.getByRole("button", { name: /create sequence/i }).click();
    });

    const card = page.locator(`[data-sequence-name="${name}"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("link", { name: "Open sequence" }).click();
    await page.waitForURL(/\/sequences\/[0-9a-f-]+$/, { timeout: 15_000 });

    await expect(page.locator("h1")).toHaveText(name);

    await page.getByRole("button", { name: "Add step" }).click();
    await expect(page.locator('input[aria-label="Delay in days"]')).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Enroll", exact: true }).click();
    await expect(page.getByText("Activate this sequence before enrolling prospects.")).toBeVisible();

    await page.getByRole("button", { name: "Analytics", exact: true }).click();
    await expect(page.getByText("Total enrolled")).toBeVisible({ timeout: 10_000 });
  });
});
