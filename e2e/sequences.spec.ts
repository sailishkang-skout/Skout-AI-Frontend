import { test, expect, type Page } from "@playwright/test";
import { gotoAppPage, waitForApiMutation } from "./helpers";

/** Creates a sequence the way a person does: Manually from scratch, a name, Open visual builder. */
async function createManualSequence(page: Page, name: string) {
  await gotoAppPage(page, "/sequences", "page-sequences");
  await page.getByRole("button", { name: /Manually from scratch/ }).click();
  await page.getByPlaceholder("e.g. Enterprise SaaS outbound").fill(name);
  await waitForApiMutation(page, "/api/v1/sequences", "POST", async () => {
    await page.getByRole("button", { name: "Open visual builder" }).click();
  });
  await page.waitForURL(/\/sequences\/[0-9a-f-]+$/, { timeout: 15_000, waitUntil: "commit" });
}

test.describe("Sequences", () => {
  test("list page loads and can create a sequence", async ({ page }) => {
    await gotoAppPage(page, "/sequences", "page-sequences");
    await expect(page.getByRole("heading", { name: "Sequence Studio" })).toBeVisible();

    const name = `E2E Sequence ${Date.now()}`;
    await createManualSequence(page, name);
    await gotoAppPage(page, "/sequences", "page-sequences");
    await expect(page.locator(`[data-sequence-name="${name}"]`)).toBeVisible({ timeout: 15_000 });
  });

  test("builder: opens on the new sequence and switches tabs", async ({ page }) => {
    const name = `E2E Builder ${Date.now()}`;
    await createManualSequence(page, name);
    await expect(page.locator("h1")).toHaveText(name);

    await page.getByRole("button", { name: "Enroll", exact: true }).click();
    await expect(page.getByText("Activate this sequence before enrolling prospects.")).toBeVisible();

    await page.getByRole("button", { name: "Analytics", exact: true }).click();
    await expect(page.getByText("Total enrolled")).toBeVisible({ timeout: 10_000 });
  });
});
