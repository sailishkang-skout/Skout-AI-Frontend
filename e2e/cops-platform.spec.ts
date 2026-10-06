import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

test.describe("CustomerOps platform (COPS-01)", () => {
  test("audit log page loads with its filter controls", async ({ page }) => {
    await gotoAppPage(page, "/cops/audit", "page-cops-audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search audit log" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  });
});
