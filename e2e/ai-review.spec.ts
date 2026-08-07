import { test, expect } from "@playwright/test";
import { gotoAppPage, waitForApiMutation } from "./helpers";

test.describe("AI Review Queue", () => {
  test("page loads and shows queue chrome", async ({ page }) => {
    await gotoAppPage(page, "/ai/review", "page-ai-review");
    await expect(page.getByRole("heading", { name: "AI Review Queue" })).toBeVisible();
    await expect(page.getByLabel("Filter by status")).toBeVisible();
    await expect(page.getByRole("button", { name: /bulk approve/i })).toBeVisible();
  });

  test("create draft via API then approve in UI", async ({ page, request }) => {
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";
    // The frontend's stub auth (useApiFetchStub in api-client.ts) hardcodes
    // "stub@example.com". To ensure the API-created draft appears in the UI's
    // draft list, the draft must be created in the SAME workspace the UI queries.
    // A unique email would provision a brand-new workspace and the card would never
    // render (GET /api/v1/ai/drafts returns drafts from the UI's own workspace only).
    const email = "stub@example.com";
    const headers = {
      "content-type": "application/json",
      "x-stub-user-email": email,
    };

    const create = await request.post(`${apiURL}/api/v1/ai/drafts`, {
      headers,
      data: {
        prospectId: `e2e-prospect-${Date.now()}`,
        subject: "E2E outreach subject",
        body: "Hello from the AI review e2e test.",
        fullName: "E2E Prospect",
      },
    });
    test.skip(!create.ok(), "POST /api/v1/ai/drafts endpoint not supported by backend");
    const draft = (await create.json()) as { id: string; subject: string };

    await gotoAppPage(page, "/ai/review", "page-ai-review");
    await page.getByLabel("Filter by status").selectOption("pending_review");

    const card = page.locator(`[data-draft-id="${draft.id}"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText("E2E outreach subject")).toBeVisible();

    await waitForApiMutation(page, `/api/v1/ai/drafts/${draft.id}/approve`, "POST", async () => {
      await card.getByRole("button", { name: /^approve/i }).click();
    });

    await page.getByLabel("Filter by status").selectOption("approved");
    await expect(page.locator(`[data-draft-id="${draft.id}"]`)).toBeVisible({ timeout: 15_000 });
  });
});
