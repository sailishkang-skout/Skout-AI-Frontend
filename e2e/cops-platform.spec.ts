import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

test.describe("CustomerOps platform (COPS-01)", () => {
  test("audit log page loads with its filter controls", async ({ page }) => {
    await gotoAppPage(page, "/cops/audit", "page-cops-audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search audit log" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  });

  test("audit filter displays the field error returned for an invalid date", async ({ page }) => {
    let invalidDateRequest: URL | undefined;
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

      invalidDateRequest = url;
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
    await expect(page.getByText("No audit events match these filters.")).toBeVisible();
    await expect(page.getByLabel("From date")).toBeVisible();
    await page.waitForFunction(() => {
      const dateInput = document.querySelector('input[aria-label="From date"]');
      return dateInput && Object.keys(dateInput).some((key) => key.startsWith("__reactProps$"));
    });
    await page.getByLabel("From date").fill("2026-10-06");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect.poll(() => invalidDateRequest?.searchParams.get("from")).toBeTruthy();
    await expect(page.getByRole("alert").filter({ hasText: "From date:" })).toContainText("Invalid datetime");
  });
});
