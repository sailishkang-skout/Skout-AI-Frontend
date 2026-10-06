import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

test.describe("CustomerOps platform (COPS-01)", () => {
  test("audit log page loads with its filter controls", async ({ page }) => {
    await gotoAppPage(page, "/cops/audit", "page-cops-audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search audit log" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  });

  test("audit filter displays a field error returned for an invalid date", async ({ page }) => {
    let receivedInvalidDateQuery = false;
    const auditRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/cops/audit")) auditRequests.push(request.url());
    });
    await page.route("**/api/v1/cops/audit**", async (route) => {
      const url = new URL(route.request().url());
      if (!url.searchParams.has("from")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], next_cursor: null }),
        });
        return;
      }
      receivedInvalidDateQuery = true;
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          code: "VALIDATION_FAILED",
          message: "Invalid query",
          details: { fields: [{ path: "from", code: "invalid_date", message: "Invalid datetime" }] },
          request_id: "e2e-request",
          retryable: false,
        }),
      });
    });

    await gotoAppPage(page, "/cops/audit", "page-cops-audit");
    await page.getByLabel("From date").fill("2026-10-06");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect.poll(() => receivedInvalidDateQuery, { message: `Audit requests: ${auditRequests.join(", ")}` }).toBe(true);
    await expect(page.getByRole("alert").filter({ hasText: "From date:" })).toContainText("From date:");
  });
});
