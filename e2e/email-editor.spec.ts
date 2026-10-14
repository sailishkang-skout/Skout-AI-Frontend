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
  // The Variable menu is tall; at the default 720px its last tokens sit below the fold.
  test.use({ viewport: { width: 1440, height: 1000 } });
  test("all 5 merge tokens insert correctly", async ({ page }) => {
    // 1. Create a fresh sequence: Manually from scratch opens the visual builder on it.
    await gotoPage(page, "/sequences", "page-sequences");
    await page.getByRole("button", { name: /Manually from scratch/ }).click();
    await page.getByPlaceholder("e.g. Enterprise SaaS outbound").fill(`Token Test ${Date.now()}`);
    await waitForPost(page, "/api/v1/sequences", async () => {
      await page.getByRole("button", { name: "Open visual builder" }).click();
    });
    await page.waitForURL(/\/sequences\/[0-9a-f-]+$/, { timeout: 15_000, waitUntil: "commit" });

    // 2. Add an email step from "Start with an action", then open it.
    const main = page.locator("main").last();
    await waitForPost(page, "/steps", async () => {
      await main.getByRole("button", { name: "Email", exact: true }).first().click();
    });
    await main.getByText("A/B testing", { exact: true }).first().click();
    const drawer = page.getByRole("dialog").filter({ hasText: "Edit Email" });
    await expect(drawer).toBeVisible({ timeout: 10_000 });

    // 3. Insert each token into the body from its Variable menu (the last one; the first is the subject's).
    const editorEl = drawer.locator(".tiptap").first();
    for (const token of TOKENS) {
      await drawer.getByRole("button", { name: "Variable", exact: true }).last().click();
      await page.getByRole("button", { name: new RegExp(token.replace(/[{}]/g, "\\$&")) }).first().click();
    }

    // 4. All tokens are in the editor, and the step saves.
    for (const token of TOKENS) {
      await expect(editorEl).toContainText(token, { timeout: 3_000 });
    }
    await drawer.getByRole("button", { name: "Save", exact: true }).click();
    await expect(drawer).toBeHidden({ timeout: 10_000 });
  });
});
