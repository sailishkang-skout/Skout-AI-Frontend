import { test, expect } from "@playwright/test";
import { crmApiURL, gotoAppPage, isCrmApiHealthy, waitForApiMutation } from "./helpers";

test.describe("CRM Contacts", () => {
  test("contacts index loads and create form is visible", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    await gotoAppPage(page, "/crm/contacts", "page-crm-contacts");
    await expect(page.getByTestId("create-contact-button")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();
  });

  test("can create a contact from the UI", async ({ page, request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    await gotoAppPage(page, "/crm/contacts", "page-crm-contacts");
    await page.getByTestId("create-contact-button").click();
    await page.getByPlaceholder("Jane", { exact: true }).fill(`E2E-${Date.now()}`);
    await waitForApiMutation(page, "/api/v1/contacts", "POST", async () => {
      await page.getByRole("button", { name: "Create contact" }).click();
    });
  });
});

test.describe("CRM Contacts API (stub auth)", () => {
  test("POST /contacts links to a company; companyId filter returns it", async ({ request }) => {
    test.skip(!(await isCrmApiHealthy(request)), "CRM API not running");

    const email = `e2e-crm-contacts-${Date.now()}@test.com`;
    const headers = { "content-type": "application/json", "x-stub-user-email": email };

    const companyRes = await request.post(`${crmApiURL}/api/v1/companies`, {
      headers,
      data: { name: `Contact Host ${Date.now()}` },
    });
    const company = await companyRes.json();

    const contactRes = await request.post(`${crmApiURL}/api/v1/contacts`, {
      headers,
      data: { firstName: "Jane", lastName: "Doe", companyId: company.id },
    });
    expect(contactRes.status()).toBe(201);
    const contact = await contactRes.json();
    expect(contact.companyId).toBe(company.id);

    const filteredRes = await request.get(`${crmApiURL}/api/v1/contacts?companyId=${company.id}`, {
      headers: { "x-stub-user-email": email },
    });
    const filtered = await filteredRes.json();
    expect(filtered.data.some((c: { id: string }) => c.id === contact.id)).toBeTruthy();
  });
});
