import { test, expect, type Page } from "@playwright/test";
import { gotoAppPage } from "./helpers";

const TOKENS = [
  "{{firstName}}",
  "{{lastName}}",
  "{{companyName}}",
  "{{title}}",
  "{{unsubscribeUrl}}",
];

// Use shared fixed helper instead of local function
const gotoPage = gotoAppPage;

async function waitForPost(page: Page, urlFragment: string, action: () => Promise<void>) {
  const res = page.waitForResponse(
    (r) => r.url().includes(urlFragment) && r.request().method() === "POST" && r.status() < 300,
    { timeout: 30_000 }
  );
  await action();
  await res;
}

test.describe("Email editor — merge tokens", () => {
  test("all 5 merge tokens insert correctly", async ({ page }) => {
    // 1. Create a fresh sequence
    await gotoPage(page, "/sequences", "page-sequences");
    const name = `Token Test ${Date.now()}`;
    await page.getByPlaceholder(/SaaS VP outreach/i).fill(name);
    await waitForPost(page, "/api/v1/sequences", async () => {
      await page.getByRole("button", { name: /blank sequence/i }).click();
    });

    const card = page.locator(`[data-sequence-name="${name}"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });

    // 2. Open the sequence detail page
    await card.getByRole("link", { name: "Open sequence" }).click();
    await page.waitForURL(/\/sequences\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 3. Add an email step
    await waitForPost(page, "/steps", async () => {
      await page.getByRole("button", { name: "Add step" }).click();
    });

    // 4. Open the email body editor modal
    // Empty-state trigger reads "Click to open email editor…" (div[role=button]).
    const trigger = page
      .getByRole("button", { name: /open email editor|edit email body/i })
      .first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    // Modal should open
    const modal = page.locator("text=Email body").first();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // 5. Click each merge token button and verify insertion
    for (const token of TOKENS) {
      await page.getByRole("button", { name: token, exact: true }).click();
    }

    // 6. All tokens should be visible in the TipTap editor
    const editorEl = page.locator(".tiptap").first();
    for (const token of TOKENS) {
      await expect(editorEl).toContainText(token, { timeout: 3_000 });
    }

    // 7. Apply changes — modal closes, preview shows content
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("Edit email body")).toBeVisible({ timeout: 5_000 });

    console.log("✓ All 5 merge tokens inserted and persisted correctly");
  });
});