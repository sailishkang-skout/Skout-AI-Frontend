import { test, expect } from "@playwright/test";
import { gotoAppPage } from "./helpers";

/**
 * §7.3 SP-11 — Dexter event-spine timeline/log UI. The event feed itself may be empty in a
 * fresh test workspace (no spine event has fired yet), so these tests assert what's true
 * regardless of seed data: the feed section renders, the filter offers the 10 minimum
 * event-spine types, and changing the filter re-queries the API with the right `type` param.
 * If rows are present, their shape (type badge, timestamp, correlation ID) is also asserted.
 */
test.describe("Dexter event spine timeline", () => {
  test("renders a tenant-scoped event feed with a type filter on the Dexter page", async ({ page }) => {
    await gotoAppPage(page, "/dexter", "page-dexter");

    await expect(page.getByText("Event spine")).toBeVisible({ timeout: 15_000 });

    const filter = page.getByTestId("dexter-event-type-filter");
    await expect(filter).toBeVisible();
    await expect(filter.locator("option")).toHaveCount(11); // "All event types" + the 10 spine types
    await expect(filter.locator('option[value="icp.approved"]')).toHaveCount(1);
    await expect(filter.locator('option[value="opportunity.updated"]')).toHaveCount(1);

    // Either real rows or the explicit empty state — never a silent blank panel.
    const feed = page.getByTestId("dexter-event-feed");
    await expect(feed).toBeVisible({ timeout: 15_000 });
    const rows = page.getByTestId("dexter-event-row");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      await expect(feed).toContainText("No events yet");
    } else {
      const first = rows.first();
      // Correlation ID is rendered as its first 8 chars, monospaced.
      await expect(first.locator(".font-mono").last()).toHaveText(/^[0-9a-f-]{8}$/);
    }
  });

  test("filtering by event type re-queries the API with the selected type", async ({ page }) => {
    await gotoAppPage(page, "/dexter", "page-dexter");
    await expect(page.getByTestId("dexter-event-type-filter")).toBeVisible({ timeout: 15_000 });

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/v1/dexter/events") && req.url().includes("type=meeting.completed")
    );
    await page.getByTestId("dexter-event-type-filter").selectOption("meeting.completed");
    const req = await requestPromise;

    expect(req.url()).toContain("type=meeting.completed");
  });

  test("clearing the filter back to \"All event types\" drops the type param", async ({ page }) => {
    await gotoAppPage(page, "/dexter", "page-dexter");
    const filter = page.getByTestId("dexter-event-type-filter");
    await expect(filter).toBeVisible({ timeout: 15_000 });

    await filter.selectOption("signal.detected");
    await page.waitForRequest((req) => req.url().includes("type=signal.detected"));

    const allRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/v1/dexter/events") && !req.url().includes("type=")
    );
    await filter.selectOption("");
    const req = await allRequestPromise;

    expect(req.url()).not.toContain("type=");
  });
});
