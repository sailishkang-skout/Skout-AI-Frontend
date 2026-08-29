import { test, expect } from "@playwright/test";

test.describe("Phone numbers marketplace", () => {
  test("settings page loads with search and request list", async ({ page }) => {
    await page.goto("/app/settings/numbers");
    await expect(page.getByTestId("page-phone-numbers")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Phone numbers" })).toBeVisible();
    await expect(page.getByTestId("search-numbers-button")).toBeVisible();
    await expect(page.getByTestId("numbers-country")).toHaveValue("US");
    await expect(page.getByTestId("numbers-area-code")).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Workspace requests" })).toBeVisible();
  });
});

test.describe("Phone numbers API (stub auth)", () => {
  test("GET /numbers/config returns marketplace flags", async ({ request }) => {
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";
    const res = await request.get(`${apiURL}/api/v1/numbers/config`, {
      headers: { "x-stub-user-email": "e2e-numbers@test.com" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        marketplaceEnabled: expect.any(Boolean),
        connectionAssigned: expect.any(Boolean),
      })
    );
  });

  test("GET /numbers/requests lists workspace rows", async ({ request }) => {
    const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";
    const res = await request.get(`${apiURL}/api/v1/numbers/requests`, {
      headers: { "x-stub-user-email": "e2e-numbers@test.com" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(typeof body.total).toBe("number");
  });
});
