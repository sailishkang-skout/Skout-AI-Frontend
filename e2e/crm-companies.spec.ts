import { test, expect } from "@playwright/test";
import { crmApiURL, gotoAppPage, isCrmApiHealthy, waitForApiMutation } from "./helpers";

test.describe("CRM Companies", () => {
  test("companies index loads and create form is visible", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    await gotoAppPage(page, "/crm/companies", "page-crm-companies");
    await expect(page.getByTestId("create-company-button")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
  });

  test("can create a company from the UI", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const companyName = `E2E Co ${Date.now()}`;
    await gotoAppPage(page, "/crm/companies", "page-crm-companies");
    await page.getByTestId("create-company-button").click();
    await page.getByPlaceholder("Acme Corp").fill(companyName);
    await waitForApiMutation(page, "/api/v1/companies", "POST", async () => {
      await page.getByRole("button", { name: "Create company" }).click();
    });
    await expect(page.getByText(companyName, { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("CRM Companies API (stub auth)", () => {
  test("POST /companies creates a company; workspace isolation on GET/:id", async ({ request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const companyName = `API E2E ${Date.now()}`;
    const ownerEmail = `e2e-crm-companies-${Date.now()}@test.com`;

    const createRes = await request.post(`${crmApiURL}/api/v1/companies`, {
      headers: { "content-type": "application/json", "x-stub-user-email": ownerEmail },
      data: { name: companyName },
    });
    expect(createRes.status()).toBe(201);
    const company = await createRes.json();

    const listRes = await request.get(`${crmApiURL}/api/v1/companies`, {
      headers: { "x-stub-user-email": ownerEmail },
    });
    expect(listRes.ok()).toBeTruthy();
    const body = await listRes.json();
    expect(body.data.some((c: { name: string }) => c.name === companyName)).toBeTruthy();

    // Cross-workspace isolation: a different stub user must not see this company.
    const otherRes = await request.get(`${crmApiURL}/api/v1/companies/${company.id}`, {
      headers: { "x-stub-user-email": `e2e-crm-other-${Date.now()}@test.com` },
    });
    expect(otherRes.status()).toBe(404);
  });
});
