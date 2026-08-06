import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

test("dashboard loads without 'Something went wrong'", async ({ page }) => {
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/v1/")) {
      apiRequests.push(`${res.status()} ${res.url()}`);
    }
  });

  await gotoAppPage(page, "/dashboard", "page-dashboard");

  const hasErrorBanner = await page.getByText("Something went wrong").count();

  console.log("PAGE_URL:", page.url());
  console.log("HAS_ERROR_BANNER:", hasErrorBanner > 0);
  console.log("CONSOLE_ERRORS:", errors);
  console.log("API_REQUESTS:", apiRequests);

  expect(hasErrorBanner).toBe(0);
});
