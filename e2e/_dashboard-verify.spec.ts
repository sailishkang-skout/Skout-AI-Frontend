import { test, expect } from "@playwright/test";

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

  await page.goto("/dashboard", { waitUntil: "networkidle" });

  const hasErrorBanner = await page.getByText("Something went wrong").count();
  // "Credits remaining" is a stat-card label that only renders once the summary
  // data has loaded successfully (the "at a glance" text is the loading fallback).
  const hasStatCards = await page.getByText("Credits remaining").count();

  console.log("PAGE_URL:", page.url());
  console.log("HAS_ERROR_BANNER:", hasErrorBanner > 0);
  console.log("HAS_STAT_CARDS:", hasStatCards > 0);
  console.log("CONSOLE_ERRORS:", errors);
  console.log("API_REQUESTS:", apiRequests);

  expect(hasErrorBanner).toBe(0);
  expect(hasStatCards).toBe(1);
});
