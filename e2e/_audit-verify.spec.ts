import { test, expect } from "@playwright/test";

// Temporary verification spec: confirms the AuditLogTimeline renders end-to-end
// in a real browser against the running frontend + CRM stub.
test("audit log timeline renders on the contact detail page", async ({ page }) => {
  // Use the stub's bypass auth (E2E_AUTH_BYPASS) so the page loads without Clerk.
  await page.goto("/crm/contacts/contact-1", { waitUntil: "domcontentloaded" });

  // The ICP gate may redirect to the onboarding welcome (empty ICP config is
  // fail-closed). Dismiss it if present so we can reach the CRM page.
  const welcome = page.getByRole("heading", { name: /Welcome to Skout AI/i });
  if (await welcome.isVisible().catch(() => false)) {
    const skip = page.getByRole("button", { name: /Skip (welcome|for now)/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.first().click();
    }
    await page.waitForTimeout(1500);
  }

  await page.goto("/crm/contacts/contact-1", { waitUntil: "domcontentloaded" });

  // If redirected again to onboarding, try skipping once more.
  if (await page.getByRole("heading", { name: /Welcome to Skout AI/i }).isVisible().catch(() => false)) {
    const skip = page.getByRole("button", { name: /Skip (welcome|for now)/i }).first();
    await skip.click();
    await page.waitForTimeout(1500);
  }

  // Wait for the audit history section to appear.
  const auditSection = page.getByText("Audit history", { exact: true });
  await expect(auditSection).toBeVisible({ timeout: 15_000 });

  // The contact has 4 audit entries (create + 3 updates) served by the stub.
  await expect(page.getByText(/create/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/update/i).first()).toBeVisible({ timeout: 15_000 });

  // Truncation footer demonstrating total > rows returned.
  await expect(page.getByText(/128/i).first()).toBeVisible({ timeout: 15_000 });

  // Sanity: the page is the CRM contact detail page.
  await expect(page).toHaveURL(/\/crm\/contacts\/contact-1$/);
});
