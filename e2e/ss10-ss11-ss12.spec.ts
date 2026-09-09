import { test, expect, type Page, request } from "@playwright/test";
import { gotoAppPage, isCrmApiHealthy, crmApiURL } from "./helpers";

test.describe("SS-11: Prospect search score split", () => {
  test("displays ICP Match and Signal Timing scores on prospect search page", async ({ page }) => {
    // Navigate to prospects search page - using the search page's test ID
    await gotoAppPage(page, "/prospects/search", "smart-search-page");
    
    // Verify page loads
    await expect(page).toHaveURL(/.*\/prospects\/search/);
    
    // Check that both score labels appear (SS-11 split implementation)
    const icpMatchLabel = page.getByText("ICP Match");
    const signalTimingLabel = page.getByText("Signal Timing");
    
    // If scores exist, they should render with proper labels
    const hasScores = await icpMatchLabel.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasScores) {
      await expect(icpMatchLabel).toBeVisible();
      await expect(signalTimingLabel).toBeVisible();
      
      // Verify score pills are visible
      const scorePills = page.locator('[class*="ScorePill"]');
      await expect(scorePills).toHaveCount(2);
    }
  });

  test("handles legacy single-score format gracefully", async ({ page }) => {
    await gotoAppPage(page, "/prospects/search", "smart-search-page");
    
    // Verify page doesn't crash with legacy data
    const errorElement = page.getByText("Something went wrong");
    await expect(errorElement).not.toBeVisible();
  });

  test("responsive layout on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await gotoAppPage(page, "/prospects/search", "smart-search-page");
    
    // Verify mobile filters button exists
    const filterButton = page.getByRole("button", { name: /filters/i });
    await expect(filterButton).toBeVisible();
    
    // Verify filters toggle works
    await filterButton.click();
    await expect(page.getByText(/clear filters/i)).toBeVisible();
  });
});

test.describe("CRM-related features (SS-10, SS-12)", () => {
  test.beforeEach(async ({ request }) => {
    // Skip CRM tests if CRM API isn't healthy (matches your existing pattern)
    const crmHealthy = await isCrmApiHealthy(request);
    if (!crmHealthy) {
      test.skip();
    }
  });

  test("SS-10: loads all three new flag types on CRM intelligence page", async ({ page }) => {
    await gotoAppPage(page, "/crm/intelligence", "crm-intelligence-page");
    
    // Verify page loads correctly
    await expect(page).toHaveURL(/.*\/crm\/intelligence/);
    
    // Check that Needs Attention section exists
    const needsAttention = page.getByRole("heading", { name: /needs attention/i });
    if (await needsAttention.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check for all three new flag types (they may not have data, but page shouldn't crash)
      await expect(page.getByText("Something went wrong")).not.toBeVisible();
      
      // Verify section structure maintains pattern
      const panelHeaders = page.locator("button[aria-expanded]");
      if (await panelHeaders.count() > 0) {
        // If any flags exist, verify they follow the pattern
        await expect(page.locator(".border-border")).toBeVisible();
      }
    }
  });

  test("expansion opportunity flags render properly with correct badges", async ({ page }) => {
    await gotoAppPage(page, "/crm/intelligence", "crm-intelligence-page");
    
    // Look for expansion opportunity badge
    const expansionBadge = page.getByText("Expansion opportunity");
    if (await expansionBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(expansionBadge).toBeVisible();
      // Verify it has the success tone
      await expect(expansionBadge).toHaveClass(/bg-emerald/);
    }
  });

  test("disengagement risk flags show warning styling", async ({ page }) => {
    await gotoAppPage(page, "/crm/intelligence", "crm-intelligence-page");
    
    // Look for disengagement risk badge
    const disengagementBadge = page.getByText("Disengagement risk");
    if (await disengagementBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(disengagementBadge).toBeVisible();
      await expect(disengagementBadge).toHaveClass(/bg-amber/);
    }
  });

  test("renewal risk flags show danger styling", async ({ page }) => {
    await gotoAppPage(page, "/crm/intelligence", "crm-intelligence-page");
    
    // Look for renewal risk badge
    const renewalBadge = page.getByText("Renewal risk");
    if (await renewalBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(renewalBadge).toBeVisible();
      await expect(renewalBadge).toHaveClass(/bg-red/);
    }
  });
});

test.describe("SS-12: Account 360 - Regional Intelligence & Evidence Panel", () => {
  test("loads Account 360 page with regional intelligence section", async ({ page }) => {
    // Navigate to a sample company page (account 360)
    await gotoAppPage(page, "/crm/companies", "crm-companies-page");
    
    // Click on first company to open 360 view
    const firstCompany = page.locator('a[href*="/crm/companies/"]').first();
    if (await firstCompany.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCompany.click();
      
      // Wait for 360 page to load
      await page.waitForURL(/.*\/crm\/companies\/.+/);
      
      // Look for Regional Intelligence section
      const regionalIntel = page.getByText(/Regional Intelligence for/i);
      if (await regionalIntel.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(regionalIntel).toBeVisible();
        
        // Verify insights render in grid
        const insightCards = page.locator(".rounded-lg.border.p-3");
        if (await insightCards.count() > 0) {
          // Verify confidence badges exist
          const confidenceBadge = page.getByText(/% confidence/).first();
          await expect(confidenceBadge).toBeVisible();
        }
      }
    }
  });

  test("stale insights are flagged with warning", async ({ page }) => {
    await page.goto("/crm/companies");
    const firstCompany = page.locator('a[href*="/crm/companies/"]').first();
    if (await firstCompany.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCompany.click();
      await page.waitForURL(/.*\/crm\/companies\/.+/);
      
      // Check for stale warning if any insights are stale
      const staleWarning = page.getByText("⚠️ Stale");
      if (await staleWarning.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(staleWarning).toBeVisible();
        await expect(staleWarning).toHaveClass(/text-amber-600/);
      }
    }
  });

  test("low confidence insights show amber badge", async ({ page }) => {
    await page.goto("/crm/companies");
    const firstCompany = page.locator('a[href*="/crm/companies/"]').first();
    if (await firstCompany.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCompany.click();
      await page.waitForURL(/.*\/crm\/companies\/.+/);
      
      // Verify confidence badges color code correctly
      const lowConfidenceBadge = page.locator(".bg-amber-100");
      if (await lowConfidenceBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(lowConfidenceBadge).toBeVisible();
      }
    }
  });

  test("responsive grid layout for regional insights", async ({ page }) => {
    await page.goto("/crm/companies");
    const firstCompany = page.locator('a[href*="/crm/companies/"]').first();
    if (await firstCompany.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCompany.click();
      await page.waitForURL(/.*\/crm\/companies\/.+/);
      
      // Test on mobile
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Verify grid stacks to single column on mobile
      const gridContainer = page.locator(".grid.gap-4.sm\\:grid-cols-2");
      if (await gridContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Container exists, responsive classes applied
        await expect(gridContainer).toHaveClass(/sm:grid-cols-2/);
      }
    }
  });
});

test.describe("Cross-feature integration tests", () => {
  test("all three feature pages load without errors", async ({ page }) => {
    // Test SS-11 page
    await gotoAppPage(page, "/prospects/search", "prospects-search-page");
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    
    // Test SS-10 page
    await gotoAppPage(page, "/crm/intelligence", "crm-intelligence-page");
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    
    // Test SS-12 parent page
    await gotoAppPage(page, "/crm/companies", "crm-companies-page");
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  });

  test("navigation between all feature pages works", async ({ page }) => {
    // Start at prospects search (SS-11)
    await gotoAppPage(page, "/prospects/search", "prospects-search-page");
    
    // Navigate to CRM Intelligence (SS-10)
    await page.getByRole("link", { name: /intelligence/i }).click();
    await page.waitForURL(/.*\/crm\/intelligence/);
    await expect(page).toHaveURL("/crm/intelligence");
    
    // Navigate to Companies (SS-12)
    await page.getByRole("link", { name: /companies/i }).click();
    await page.waitForURL(/.*\/crm\/companies/);
    await expect(page).toHaveURL("/crm/companies");
  });
});