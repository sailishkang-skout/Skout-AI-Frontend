import { test, expect } from "@playwright/test";
import { gotoAppPage, waitForApiMutation } from "./helpers";

test.describe("Lists", () => {
  test("lists index loads and create form is visible", async ({ page }) => {
    await gotoAppPage(page, "/lists", "page-lists");
    await expect(page.getByTestId("create-list-button")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible();
  });

  test("can create a list from the UI", async ({ page }) => {
    const listName = `E2E List ${Date.now()}`;
    await gotoAppPage(page, "/lists", "page-lists");
    await page.getByPlaceholder(/Seed SaaS/i).fill(listName);
    await waitForApiMutation(page, "/api/v1/lists", "POST", async () => {
      await page.getByTestId("create-list-button").click();
    });
    await expect(page.getByText(listName, { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Lists API (stub auth)", () => {
  test("POST /lists creates a list", async ({ request }) => {
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";
    const listName = `API E2E ${Date.now()}`;

    const createRes = await request.post(`${apiURL}/api/v1/lists`, {
      headers: {
        "content-type": "application/json",
        "x-stub-user-email": "e2e-api-lists@test.com",
      },
      data: { name: listName },
    });
    expect(createRes.status()).toBe(201);

    const listRes = await request.get(`${apiURL}/api/v1/lists`, {
      headers: { "x-stub-user-email": "e2e-api-lists@test.com" },
    });
    expect(listRes.ok()).toBeTruthy();
    const body = await listRes.json();
    expect(body.data.some((l: { name: string }) => l.name === listName)).toBeTruthy();
  });
});
