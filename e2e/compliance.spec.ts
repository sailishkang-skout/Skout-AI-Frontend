import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * §16 Compliance center — suppression (DNC), consent history and DSAR. The API is mocked with a
 * small in-memory store so these tests exercise the UI contract (including the 409/alreadyExisted
 * responses and the DSAR status workflow) without writing to a real database.
 */

interface Dsar {
  id: string;
  workspaceId: string;
  requestType: string;
  subjectEmail: string;
  status: string;
  fulfillmentMode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const NOW = new Date().toISOString();

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockCompliance(page: Page) {
  const suppressions = [
    { id: "s1", workspaceId: "w", email: "existing@example.com", reason: "manual_dnc", createdAt: NOW },
  ];
  const consents = [
    {
      id: "c1", workspaceId: "w", subjectType: "prospect", subjectId: "aaaaaaaa-1111", type: "email",
      basis: "legitimate_interest", grantedAt: NOW, revokedAt: null as string | null, recordedBy: null,
    },
  ];
  const dsars: Dsar[] = [];
  let seq = 0;

  // Add-DNC and DSAR actions are admin-only in the UI; pin the role so the spec doesn't depend on the seeded user.
  await page.route("**/api/v1/me", (route) => json(route, 200, { userId: "u1", role: "owner" }));

  await page.route("**/api/v1/suppressions**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET") {
      const q = (url.searchParams.get("email") ?? "").toLowerCase();
      const data = suppressions.filter((s) => s.email.includes(q));
      return json(route, 200, { data, total: data.length });
    }
    if (req.method() === "POST") {
      const { email } = req.postDataJSON() as { email: string };
      const found = suppressions.find((s) => s.email === email.toLowerCase());
      if (found) return json(route, 200, { data: found, alreadyExisted: true });
      const row = { id: `s${suppressions.length + 1}`, workspaceId: "w", email: email.toLowerCase(), reason: "manual_dnc", createdAt: NOW };
      suppressions.unshift(row);
      return json(route, 201, { data: row, alreadyExisted: false });
    }
    if (req.method() === "DELETE") {
      const id = url.pathname.split("/").pop();
      const i = suppressions.findIndex((s) => s.id === id);
      if (i >= 0) suppressions.splice(i, 1);
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });

  await page.route("**/api/v1/compliance/consents**", (route) =>
    json(route, 200, { data: consents, total: consents.length })
  );
  await page.route("**/api/v1/consents/*/revoke", (route) => {
    const id = route.request().url().split("/consents/")[1]!.split("/")[0];
    const c = consents.find((x) => x.id === id)!;
    c.revokedAt = NOW;
    return json(route, 200, { data: c });
  });

  await page.route("**/api/v1/dsar**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") return json(route, 200, { data: dsars, total: dsars.length });
    if (req.method() === "POST") {
      const body = req.postDataJSON() as { requestType: string; subjectEmail: string; fulfillmentMode: string };
      const email = body.subjectEmail.toLowerCase();
      const open = dsars.some(
        (d) => d.subjectEmail === email && d.requestType === body.requestType && ["received", "in_progress"].includes(d.status)
      );
      if (open) {
        return json(route, 409, { ok: false, error: "dsar_already_open", statusCode: 409, message: "dsar_already_open" });
      }
      const auto = body.fulfillmentMode === "auto";
      const row: Dsar = {
        id: `d${++seq}`, workspaceId: "w", requestType: body.requestType, subjectEmail: email,
        status: auto ? "completed" : "received", fulfillmentMode: body.fulfillmentMode,
        notes: null, createdAt: NOW, updatedAt: NOW,
      };
      dsars.unshift(row);
      return json(route, 201, { data: row });
    }
    if (req.method() === "PATCH") {
      const id = new URL(req.url()).pathname.split("/").pop();
      const { status } = req.postDataJSON() as { status: string };
      const row = dsars.find((d) => d.id === id)!;
      row.status = status;
      return json(route, 200, { data: row });
    }
    return route.fallback();
  });
}

async function openCompliance(page: Page) {
  await mockCompliance(page);
  await gotoAppPage(page, "/settings/compliance", "page-compliance");
}

test.describe("Compliance center — suppression list", () => {
  test("adds an email to DNC and shows it in the list and badge", async ({ page }) => {
    await openCompliance(page);
    await expect(page.getByText("1 Suppressed")).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder("contact@target-domain.com").fill("New.Person@Example.com");
    await page.getByRole("button", { name: "Add DNC" }).click();

    await expect(page.getByText("new.person@example.com")).toBeVisible();
    await expect(page.getByText("2 Suppressed")).toBeVisible();
  });

  test("adding an already-suppressed email shows an 'already exists' error", async ({ page }) => {
    await openCompliance(page);
    await page.getByPlaceholder("contact@target-domain.com").fill("existing@example.com");
    await page.getByRole("button", { name: "Add DNC" }).click();

    await expect(page.getByText("existing@example.com already exists in the suppression list")).toBeVisible();
    await expect(page.getByText("1 Suppressed")).toBeVisible();
  });

  test("search treats % literally-safe and filters results", async ({ page }) => {
    await openCompliance(page);
    await page.getByPlaceholder("Search suppressed emails…").fill("existing");
    await expect(page.getByText("existing@example.com")).toBeVisible();
    await page.getByPlaceholder("Search suppressed emails…").fill("nomatch");
    await expect(page.getByText("existing@example.com")).toHaveCount(0);
  });
});

test.describe("Compliance center — consent history", () => {
  test("revoking a consent marks it revoked and removes the action", async ({ page }) => {
    await openCompliance(page);
    const revoke = page.getByRole("button", { name: "Revoke" });
    await expect(revoke).toHaveCount(1, { timeout: 15_000 });
    await revoke.click();
    await expect(page.getByText(/Revoked/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  });
});

test.describe("Compliance center — DSAR", () => {
  async function submit(page: Page, email: string, type: string) {
    await page.getByPlaceholder("subject@email.com").fill(email);
    await page.locator("select").last().selectOption(type);
    await page.getByRole("button", { name: "Submit DSAR" }).click();
  }

  test("access request is auto-fulfilled and listed as completed", async ({ page }) => {
    await openCompliance(page);
    await submit(page, "Subject@Example.com", "access");

    const row = page.locator("div.rounded-lg", { hasText: "subject@example.com" }).last();
    await expect(row).toContainText("completed", { ignoreCase: true });
    await expect(row).toContainText("auto fulfillment");
    await expect(row.getByRole("button", { name: /Start|Complete|Reject/ })).toHaveCount(0);
  });

  test("erasure request is manual and can be started then completed", async ({ page }) => {
    await openCompliance(page);
    await submit(page, "erase@example.com", "erasure");

    const row = page.locator("div.rounded-lg", { hasText: "erase@example.com" }).last();
    await expect(row).toContainText("received", { ignoreCase: true });
    await expect(row).toContainText("manual fulfillment");

    await row.getByRole("button", { name: "Start" }).click();
    await expect(row).toContainText("in_progress", { ignoreCase: true });
    await expect(row.getByRole("button", { name: "Start" })).toHaveCount(0);

    await row.getByRole("button", { name: "Complete" }).click();
    await expect(row).toContainText("completed", { ignoreCase: true });
    await expect(row.getByRole("button", { name: "Complete" })).toHaveCount(0);
  });

  test("an open request can be rejected", async ({ page }) => {
    await openCompliance(page);
    await submit(page, "reject@example.com", "rectification");
    const row = page.locator("div.rounded-lg", { hasText: "reject@example.com" }).last();
    await row.getByRole("button", { name: "Reject" }).click();
    await expect(row).toContainText("rejected", { ignoreCase: true });
  });

  test("a duplicate open request is refused with a friendly message", async ({ page }) => {
    await openCompliance(page);
    await submit(page, "dupe@example.com", "erasure");
    const rows = page.locator("div.rounded-lg.border", { hasText: "dupe@example.com" });
    await expect(rows.filter({ hasText: /erasure/i })).toHaveCount(1);

    await submit(page, "dupe@example.com", "erasure");
    await expect(
      page.getByText("An open request of this type already exists for this email.").first()
    ).toBeVisible();
    await expect(rows.filter({ hasText: /erasure/i })).toHaveCount(1);
  });

  test("Submit is disabled until an email is entered", async ({ page }) => {
    await openCompliance(page);
    await expect(page.getByRole("button", { name: "Submit DSAR" })).toBeDisabled();
    await page.getByPlaceholder("subject@email.com").fill("a@b.co");
    await expect(page.getByRole("button", { name: "Submit DSAR" })).toBeEnabled();
  });
});
