import { test, expect as baseExpect, type Page, type Route } from "@playwright/test";

/**
 * ENR-06 — the engineering handoff's manual acceptance cases, as UI flows. The API is mocked
 * with the shapes the backend returns; what the backend does with a capture, a job or a
 * campaign is covered by its own acceptance suite
 * (apps/api/src/routes/enrichment-acceptance.routes.test.ts in Skout-AI-Backend).
 *
 * What these cannot cover is the extension reading a real LinkedIn page: cases 1–5 and 7 are
 * also run by hand on UAT before a release (docs/ops/enrichment-release-gates.md).
 */

// These tests visit many routes, and on a cold dev server each one compiles on first visit, which
// can take longer than the default 5s an assertion waits. Seen as flaky runs in CI and locally.
const expect = baseExpect.configure({ timeout: 20_000 });

const PERMS = ["enrichment:read", "enrichment:capture", "enrichment:enrich", "enrichment:export", "enrichment:delete", "enrichment:admin", "sequences:send"];
const COMPANY = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-10-12T09:00:00.000Z";

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const fact = (attribute: string, overrides: Record<string, unknown> = {}) => ({
  evidenceId: `ev-${attribute}`,
  attribute,
  value: "x",
  source: "linkedin_public_profile",
  sourceUrl: "https://www.linkedin.com/in/priya-raman/",
  observedAt: NOW,
  capturedAt: NOW,
  confidence: 0.9,
  state: "verified",
  method: "extension_rendered_dom",
  freshnessExpiresAt: "2027-01-10T09:00:00.000Z",
  stale: false,
  usableForClaims: true,
  ...overrides,
});

const summary = (overrides: Record<string, unknown> = {}) => ({
  prospectId: "p-priya",
  contactId: "c1",
  fullName: "Priya Raman",
  headline: "Head of Revenue at Initech",
  title: "Head of Revenue",
  companyId: COMPANY,
  companyName: "Initech",
  location: "Pune, India",
  linkedinUrl: "https://www.linkedin.com/in/priya-raman/",
  salesNavigatorLeadUrl: null,
  identity: "public_profile",
  employmentState: "verified",
  seniority: null,
  jobFunction: null,
  captureSource: "linkedin-public-profile",
  sourceUrl: "https://www.linkedin.com/in/priya-raman/",
  capturedAt: NOW,
  pendingCapture: false,
  ...overrides,
});

const person = (overrides: Record<string, unknown> = {}) => ({
  ...summary(),
  summary: "Runs revenue operations.",
  connectionsCount: 500,
  followersCount: 1200,
  relationshipContext: { degree: 2, mutualConnectionsText: "12 mutual connections" },
  experience: { current: [{ name: "Initech", title: "Head of Revenue", dates: "Mar 2024 - Present" }], previous: [{ name: "Hooli", title: "Sales Manager", dates: "2020 - 2024" }] },
  educations: [{ school: "IIT Bombay", degree: "B.Tech" }],
  skills: [{ name: "Revenue Operations", endorsements: 8 }],
  certifications: [],
  languages: [],
  companyDomain: "initech.example",
  identityKeys: ["in:priya-raman"],
  candidateCompanies: [],
  facts: ["fullName", "headline", "employment", "locationName", "summary", "currentCompanies", "previousCompanies", "educations", "skills", "relationshipContext"].map((attribute) => fact(attribute)),
  evidence: [fact("headline")],
  changes: [],
  freshness: { capturedAt: NOW, stale: false },
  ...overrides,
});

const salesLead = (overrides: Record<string, unknown> = {}) =>
  summary({
    prospectId: "p-lead",
    fullName: "Lena Ortiz",
    headline: "Account Executive at Initech",
    title: "Account Executive",
    linkedinUrl: null,
    salesNavigatorLeadUrl: "https://www.linkedin.com/sales/lead/ACwAAA1,NAME_SEARCH,x",
    identity: "sales_lead",
    employmentState: "candidate",
    captureSource: "sales-navigator-search-result",
    ...overrides,
  });

const company = {
  id: COMPANY,
  name: "Initech",
  domain: "initech.example",
  industry: "Software Development",
  employeeCount: 412,
  location: "Austin, Texas",
  updatedAt: NOW,
  linkedinUrl: "https://www.linkedin.com/company/initech/",
  capture: {
    capturedAt: NOW,
    sourceUrl: "https://www.linkedin.com/company/initech/about/",
    tagline: "Software that works.",
    overview: "Initech builds software.",
    website: "https://www.initech.example",
    size: "201-500 employees",
    headquarter: "Austin, Texas",
    foundedAt: "1999",
    specialties: [],
    followers: 1000,
    openJobs: 3,
    sections: ["about", "people"],
  },
  people: { visibleAssociatedMembers: 412, verifiedEmployees: 1, discoveryCandidates: 2 },
  facts: ["name", "website", "industry", "headquarter", "size", "overview"].map((attribute) => fact(attribute, { source: "linkedin_company_page", confidence: 0.85 })),
  evidence: [],
  changes: [],
  freshness: { capturedAt: NOW, stale: false },
};

const job = (overrides: Record<string, unknown> = {}) => ({
  id: JOB,
  correlationId: "44444444-4444-4444-8444-444444444444",
  status: "queued",
  terminal: false,
  targetType: "person",
  targetId: "p-priya",
  sourceUrl: "https://www.linkedin.com/in/priya-raman/",
  normalizedUrl: "https://www.linkedin.com/in/priya-raman/",
  provider: "unipile",
  trigger: "re_enrich",
  attemptCount: 0,
  maxAttempts: 3,
  nextAttemptAt: null,
  errorCode: null,
  errorMessage: null,
  result: null,
  testMode: false,
  queuedAt: NOW,
  startedAt: null,
  completedAt: null,
  updatedAt: NOW,
  ...overrides,
});

const run = (overrides: Record<string, unknown> = {}) => ({
  id: "55555555-5555-4555-8555-555555555555",
  kind: "sales_search",
  status: "completed",
  terminal: true,
  sourceUrl: "https://www.linkedin.com/sales/search/people",
  pagesRead: 8,
  leadsReceived: 183,
  leadsCreated: 183,
  leadsMerged: 0,
  leadsRejected: 0,
  errorCode: null,
  errorMessage: null,
  startedAt: NOW,
  completedAt: NOW,
  ...overrides,
});

const NO_CONTACT = { prospectId: "p-priya", contactId: "c1", email: null, phone: null, otherPhones: [], lastRun: null, freshnessDays: 90 };

/** Every request is answered; a test overrides only the routes it is about. */
async function mockApi(page: Page, options: { released?: boolean } = {}) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("skout.productTour.v2", JSON.stringify({ welcomeSeen: true, dismissed: true, completed: true }));
    } catch {}
  });
  await page.route("**/api/v1/**", (route) => json(route, { data: [] }));
  await page.route("**/api/v1/me", (route) => json(route, { workspaceId: "ws", role: "owner", permissions: PERMS }));
  await page.route("**/api/v1/enrichment/release", (route) =>
    json(route, options.released === false ? { enabled: false, stage: "internal", reason: "LinkedIn enrichment is in internal release and is not enabled for this workspace." } : { enabled: true, stage: "general", reason: null })
  );
  await page.route("**/api/v1/enrichment/people/*/contact-data", (route) => json(route, { contactData: NO_CONTACT }));
  await page.route("**/api/v1/enrichment/provider-jobs?**", (route) => json(route, { data: [], total: 0 }));
  await page.route("**/api/v1/enrichment/providers", (route) => json(route, { testMode: false, providers: [], connections: [] }));
}

const open = (page: Page, path: string) => page.goto(`/app${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
const heading = (page: Page, name: string | RegExp) => page.getByRole("heading", { name });

test.describe("Enrichment acceptance cases (ENR-06)", () => {
  test("case 1 — a captured public profile can be reviewed, with evidence on every fact", async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/v1/enrichment/people/p-priya", (route) => json(route, { person: person() }));
    await open(page, "/enrichment/people/p-priya");
    await expect(heading(page, "Priya Raman")).toBeVisible();
    await expect(page.getByText("Verified employee")).toBeVisible();
    await expect(page.getByText("Sales Manager")).toBeVisible();
    await expect(page.getByText("IIT Bombay")).toBeVisible();
    const badges = page.getByTestId("evidence-badge");
    await expect(badges.first()).toContainText(/LinkedIn profile · captured .*2026.* · 90% confidence/);
    // No displayed fact is without a recorded source.
    await expect(page.locator('[data-testid="evidence-badge"][data-state="missing"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Open LinkedIn profile/ })).toHaveAttribute("href", "https://www.linkedin.com/in/priya-raman/");
  });

  test("case 2 — a company shows its About facts and keeps verified employees apart from candidates", async ({ page }) => {
    await mockApi(page);
    await page.route(`**/api/v1/enrichment/companies/${COMPANY}`, (route) => json(route, { company }));
    await page.route(`**/api/v1/enrichment/companies/${COMPANY}/people**`, (route) => {
      const group = new URL(route.request().url()).searchParams.get("group");
      const people =
        group === "verified"
          ? [{ ...summary(), discoverySource: null, discoveredAt: null }]
          : [
              { ...salesLead(), discoverySource: "sales-navigator-search-result", discoveredAt: NOW },
              { ...summary({ prospectId: "p-tab", fullName: "Tab Person", employmentState: "candidate", linkedinUrl: "https://www.linkedin.com/in/tab-person/" }), discoverySource: "company-search-result", discoveredAt: NOW },
            ];
      return json(route, { group, people, total: people.length, page: 1, pageSize: 15 });
    });
    await open(page, `/enrichment/companies/${COMPANY}`);
    await expect(heading(page, "Initech")).toBeVisible();
    await expect(page.getByText("201-500 employees").first()).toBeVisible();
    await expect(page.getByText("The count LinkedIn displayed, not the number of records that can be captured.")).toBeVisible();

    const verified = page.getByTestId("company-people-verified");
    const candidates = page.getByTestId("company-people-candidates");
    await expect(verified.getByRole("link", { name: "Priya Raman" })).toBeVisible();
    await expect(verified.getByRole("link", { name: "Lena Ortiz" })).toHaveCount(0);
    await expect(candidates.getByRole("link", { name: "Lena Ortiz" })).toBeVisible();
    await expect(candidates.getByRole("link", { name: "Tab Person" })).toBeVisible();
    await expect(candidates.getByText(/can include former employees, affiliates/)).toBeVisible();
  });

  test("case 3 — an eight-page Sales Navigator run is logged, and a lead without a public link stays a Sales lead", async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/v1/enrichment/capture/status", (route) =>
      json(route, { enabled: true, disabledReason: null, caps: { maxPagesPerRun: 10, maxLeadsPerRun: 250, dailyLeadLimit: 1000 }, usage: { leadsToday: 183, remainingToday: 817 } })
    );
    await page.route("**/api/v1/enrichment/capture/runs", (route) => json(route, { runs: [run()], total: 1 }));
    await open(page, "/enrichment/capture");
    await expect(page.getByText("8 pages · 183 leads received · 183 new · 0 merged · 0 rejected")).toBeVisible();
    await expect(page.getByText(/10 pages or 250 leads/).first()).toBeVisible();

    await page.route("**/api/v1/enrichment/people/p-lead", (route) =>
      json(route, { person: person({ ...salesLead(), identityKeys: ["sales-lead:ACwAAA1"], facts: [fact("employment", { state: "discovery", source: "sales_navigator_search_result", confidence: 0.5, usableForClaims: false })], evidence: [] }) })
    );
    await open(page, "/enrichment/people/p-lead");
    await expect(heading(page, "Lena Ortiz")).toBeVisible();
    await expect(page.getByText("Discovered candidate")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Sales Navigator lead/ })).toBeVisible();
    // No public profile link is shown, because none was ever seen.
    await expect(page.getByRole("link", { name: /Open LinkedIn profile/ })).toHaveCount(0);
    await expect(page.getByText(/Skout never builds a profile URL from a lead ID/)).toBeVisible();
  });

  test("case 4 — repeating a department search shows merges, not new people", async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/v1/enrichment/capture/status", (route) =>
      json(route, { enabled: true, disabledReason: null, caps: { maxPagesPerRun: 10, maxLeadsPerRun: 250, dailyLeadLimit: 1000 }, usage: { leadsToday: 24, remainingToday: 976 } })
    );
    await page.route("**/api/v1/enrichment/capture/runs", (route) =>
      json(route, {
        runs: [
          run({ id: "66666666-6666-4666-8666-666666666666", pagesRead: 1, leadsReceived: 12, leadsCreated: 0, leadsMerged: 12 }),
          run({ id: "77777777-7777-4777-8777-777777777777", pagesRead: 1, leadsReceived: 12, leadsCreated: 12, leadsMerged: 0 }),
        ],
        total: 2,
      })
    );
    await page.route("**/api/v1/enrichment/people?**", (route) => json(route, { people: Array.from({ length: 12 }, (_, index) => salesLead({ prospectId: `p-${index}`, fullName: `Dept Lead ${index}` })), total: 12, page: 1, pageSize: 25 }));
    await open(page, "/enrichment/capture");
    await expect(page.getByText("1 pages · 12 leads received · 12 new · 0 merged · 0 rejected")).toBeVisible();
    await expect(page.getByText("1 pages · 12 leads received · 0 new · 12 merged · 0 rejected")).toBeVisible();
    await open(page, "/enrichment/people");
    await expect(page.getByRole("link", { name: /^Dept Lead \d+$/ })).toHaveCount(12);
  });

  test("case 5 — attaching a public URL to a lead merges it and does not verify the employer", async ({ page }) => {
    await mockApi(page);
    let attached = "";
    const lead = person({ ...salesLead(), identityKeys: ["sales-lead:ACwAAA1"], evidence: [] });
    await page.route("**/api/v1/enrichment/people/p-lead", (route) =>
      json(route, { person: attached ? { ...lead, identity: "public_profile", linkedinUrl: attached, identityKeys: ["in:lena-ortiz", "sales-lead:ACwAAA1"] } : lead })
    );
    await page.route("**/api/v1/enrichment/people/p-lead/public-url", async (route) => {
      attached = route.request().postDataJSON().url;
      return json(route, { prospectId: "p-lead", linkedinUrl: attached, merged: false });
    });
    await open(page, "/enrichment/people/p-lead");
    const attach = page.getByRole("button", { name: "Attach URL" });
    await expect(attach).toBeDisabled();
    await page.getByLabel("Public LinkedIn profile URL").fill("https://www.linkedin.com/in/lena-ortiz/");
    await attach.click();
    await expect(page.getByText(/Public profile URL attached\. Capture that profile to verify the current employer\./)).toBeVisible();
    expect(attached).toBe("https://www.linkedin.com/in/lena-ortiz/");
    await expect(page.getByRole("link", { name: /Open LinkedIn profile/ })).toHaveAttribute("href", "https://www.linkedin.com/in/lena-ortiz/");
    // Still a candidate: only a capture of their own profile verifies where they work.
    await expect(page.getByText("Discovered candidate")).toBeVisible();
    await expect(page.getByText("Verified employee")).toHaveCount(0);
    await expect(attach).toHaveCount(0);
  });

  test("case 6 — CSV export, re-enrich and delete all work from the person page", async ({ page }) => {
    await mockApi(page);
    let deleted = false;
    let jobs: unknown[] = [];
    await page.route("**/api/v1/enrichment/people/p-priya", (route) => {
      if (route.request().method() === "DELETE") {
        deleted = true;
        return json(route, { success: true, deletedId: "p-priya", evidenceRemoved: 11, contactRemoved: false });
      }
      return json(route, { person: person() });
    });
    await page.route("**/api/v1/enrichment/people/p-priya/export.csv", (route) => route.fulfill({ status: 200, contentType: "text/csv; charset=utf-8", body: "prospectId,fullName\np-priya,Priya Raman\n" }));
    await page.route("**/api/v1/enrichment/provider-jobs?**", (route) => json(route, { data: jobs, total: jobs.length }));
    await page.route("**/api/v1/enrichment/provider-jobs", (route) => {
      jobs = [job({ status: "action_required", terminal: true, attemptCount: 1, errorCode: "PROVIDER_CONNECTION_REQUIRED", errorMessage: "Connect an authorised LinkedIn provider account before background enrichment can run.", completedAt: NOW })];
      return json(route, { job: job(), reused: false, testMode: false }, 202);
    });
    await page.route("**/api/v1/enrichment/people?**", (route) => json(route, { people: [], total: 0, page: 1, pageSize: 25 }));
    await open(page, "/enrichment/people/p-priya");
    await expect(heading(page, "Priya Raman")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Export CSV" }).click();
    expect((await download).suggestedFilename()).toMatch(/^person-.*\.csv$/);

    const reEnrich = page.getByTestId("re-enrich");
    await expect(reEnrich.getByText("No provider run yet.")).toBeVisible();
    await reEnrich.getByRole("button", { name: /Re-enrich/ }).click();
    // The run stopped for a reason the user can act on, and says so.
    await expect(reEnrich.getByTestId("job-status")).toHaveAttribute("data-status", "action_required");
    await expect(reEnrich.getByText(/Connect an authorised LinkedIn provider account/)).toBeVisible();
    await expect(reEnrich.getByRole("link", { name: "Connect a provider" })).toHaveAttribute("href", /\/enrichment\/providers$/);

    await page.getByRole("button", { name: "Delete" }).click();
    expect(deleted).toBe(false);
    await page.getByRole("dialog").getByRole("button", { name: "Delete record" }).click();
    await expect(page).toHaveURL(/\/enrichment\/people$/);
    expect(deleted).toBe(true);
  });

  test("case 7 — after a backend restart a queued job is seen to recover or to fail, never to hang as success", async ({ page }) => {
    await mockApi(page);
    let phase: "queued" | "requeued" | "lost" = "queued";
    const current = () =>
      phase === "queued"
        ? job()
        : phase === "requeued"
          ? job({ attemptCount: 1, errorCode: "WORKER_INTERRUPTED", errorMessage: "The worker stopped while this job was running. It has been queued again." })
          : job({ status: "failed", terminal: true, attemptCount: 3, errorCode: "WORKER_LOST", errorMessage: "The worker stopped while this job was running and no attempts were left. Start it again to retry.", completedAt: NOW });
    await page.route("**/api/v1/enrichment/people/p-priya", (route) => json(route, { person: person() }));
    await page.route("**/api/v1/enrichment/provider-jobs?**", (route) => json(route, { data: [current()], total: 1 }));
    await open(page, "/enrichment/people/p-priya");
    const reEnrich = page.getByTestId("re-enrich");
    await expect(reEnrich.getByTestId("job-status")).toHaveAttribute("data-status", "queued");
    // A run in progress cannot be started twice.
    await expect(reEnrich.getByRole("button", { name: /Re-enrich/ })).toBeDisabled();

    phase = "requeued";
    await expect(reEnrich.getByText(/It has been queued again/)).toBeVisible({ timeout: 15_000 });
    await expect(reEnrich.getByText(/Finished/)).toHaveCount(0);

    phase = "lost";
    await expect(reEnrich.getByTestId("job-status")).toHaveAttribute("data-status", "failed", { timeout: 15_000 });
    await expect(reEnrich.getByText(/no attempts were left\. Start it again to retry\./)).toBeVisible();
    await expect(reEnrich.getByRole("button", { name: /Re-enrich/ })).toBeEnabled();

    // A capture the extension never finished is listed as failed, with why.
    await page.route("**/api/v1/enrichment/capture/status", (route) =>
      json(route, { enabled: true, disabledReason: null, caps: { maxPagesPerRun: 10, maxLeadsPerRun: 250, dailyLeadLimit: 1000 }, usage: { leadsToday: 23, remainingToday: 977 } })
    );
    await page.route("**/api/v1/enrichment/capture/runs", (route) =>
      json(route, { runs: [run({ status: "failed", pagesRead: 1, leadsReceived: 23, leadsCreated: 23, errorCode: "abandoned", errorMessage: "The capture was not finished. The browser tab was closed or the extension was reloaded.", completedAt: NOW })], total: 1 })
    );
    await open(page, "/enrichment/capture");
    await expect(page.getByText("Failed", { exact: true })).toBeVisible();
    await expect(page.getByText(/The capture was not finished\. The browser tab was closed or the extension was reloaded\./)).toBeVisible();
  });

  test("case 8 — a campaign shows sandbox sending and cannot be launched before approval", async ({ page }) => {
    await mockApi(page);
    const claim = { kind: "role", text: "I saw that you're Head of Revenue at Initech.", evidenceId: "ev-role", attribute: "employment", source: "linkedin_public_profile", sourceUrl: "https://www.linkedin.com/in/priya-raman/", capturedAt: NOW, observedAt: NOW, confidence: 0.9, state: "verified", stale: false, usable: true, excludedReason: null };
    const recipient = (overrides: Record<string, unknown> = {}) => ({
      prospectId: "p-priya",
      fullName: "Priya Raman",
      email: "priya@sandbox.example",
      eligibility: "eligible",
      exclusionReason: null,
      exclusionMessage: null,
      emailVerification: "valid",
      consentStatus: "missing",
      suppressed: false,
      decision: "included",
      decisionComment: null,
      claims: { reason: claim, talkingPoints: [], flagged: [], opening: claim.text },
      enrolled: false,
      outcome: { sentAt: null, repliedAt: null, bouncedAt: null, unsubscribedAt: null },
      ...overrides,
    });
    let status = "draft";
    let launched = false;
    const detail = () => ({
      campaign: { id: CAMPAIGN, name: "Sandbox exercise", status, trigger: "manual", audienceId: null, sequenceId: launched ? "seq-1" : null, recipientCount: 2, consentBasis: null, reviewComment: null, submittedAt: null, approvedBy: status === "approved" ? "u1" : null, approvedAt: status === "approved" || launched ? NOW : null, launchedAt: launched ? NOW : null, createdAt: NOW, updatedAt: NOW },
      draft: { steps: [{ order: 1, delayDays: 0, subject: "A quick question", body: "Hi {{firstName}},\n\n{{opening}}\n\nWe help revenue teams." }] },
      problems: [],
      recipients: [recipient(), recipient({ prospectId: "p-sam", fullName: "Sam Suppressed", email: "sam@sandbox.example", eligibility: "excluded", exclusionReason: "suppressed", exclusionMessage: "The address is on the workspace suppression list (unsubscribed or blocked)", suppressed: true })],
      counts: { total: 2, eligible: 1, excluded: 1, included: 1, withoutTalkingPoint: 0, consentMissing: 1 },
      outcomes: { enrolled: launched ? 1 : 0, sent: 0, replied: 0, bounced: 0, unsubscribed: 0 },
      reviews: [],
      sendEnabled: status === "approved",
      consentEnforced: false,
      sandbox: { active: true, allowedRecipients: ["@sandbox.example"] },
      openingToken: "{{opening}}",
    });
    await page.route(`**/api/v1/enrichment/campaigns/${CAMPAIGN}`, (route) => json(route, detail()));
    await page.route(`**/api/v1/enrichment/campaigns/${CAMPAIGN}/submit`, (route) => {
      status = "pending_review";
      return json(route, detail());
    });
    await page.route(`**/api/v1/enrichment/campaigns/${CAMPAIGN}/review`, (route) => {
      status = "approved";
      return json(route, detail());
    });
    await page.route(`**/api/v1/enrichment/campaigns/${CAMPAIGN}/launch`, (route) => {
      launched = true;
      status = "launched";
      return json(route, { ...detail(), enrolled: 1, skipped: [] });
    });

    await open(page, `/enrichment/campaigns/${CAMPAIGN}`);
    await expect(heading(page, "Sandbox exercise")).toBeVisible();
    await expect(page.getByText(/This is not production\. Campaign emails go only to: @sandbox\.example/)).toBeVisible();
    const launch = page.getByRole("button", { name: "Launch sequence" });
    await expect(launch).toBeDisabled();
    await expect(page.getByTestId("send-state")).toContainText("No approval is recorded yet");
    // The talking point carries its evidence, and the excluded recipient says why.
    await expect(page.getByTestId("claim").first()).toContainText(/Verified.*LinkedIn profile · captured .* · 90% confidence/);
    await expect(page.getByText(/on the workspace suppression list/)).toBeVisible();

    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(launch).toBeDisabled();
    await page.getByRole("button", { name: "Approve recipients and copy" }).click();
    await expect(launch).toBeEnabled();
    expect(launched).toBe(false);
    await launch.click();
    await expect(page.getByText(/Launched\. 1 recipient enrolled\./)).toBeVisible();
    await expect(page.getByTestId("campaign-status")).toHaveAttribute("data-status", "launched");
  });
});

test.describe("Enrichment screens — states and release gate (ENR-06)", () => {
  test("a failed load is shown with a retry that recovers", async ({ page }) => {
    await mockApi(page);
    let fail = true;
    await page.route("**/api/v1/enrichment/people?**", (route) =>
      fail ? json(route, { error: "internal_error", message: "The API returned a server error." }, 500) : json(route, { people: [summary()], total: 1, page: 1, pageSize: 25 })
    );
    await open(page, "/enrichment/people");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Priya Raman" })).toHaveCount(0);
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("link", { name: "Priya Raman" })).toBeVisible();
  });

  test("an empty workspace says what to do next on each list", async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/v1/enrichment/people?**", (route) => json(route, { people: [], total: 0, page: 1, pageSize: 25 }));
    await page.route("**/api/v1/enrichment/campaigns", (route) => json(route, { campaigns: [], total: 0 }));
    await page.route("**/api/v1/enrichment/campaigns/review-queue", (route) => json(route, { items: [], total: 0 }));
    await page.route("**/api/v1/enrichment/audiences/preview", (route) =>
      json(route, { counts: { total: 0, verifiedEmployment: 0, discoveryOnly: 0, fresh: 0, stale: 0, withEmail: 0, verifiedEmail: 0, suppressed: 0, freshnessDays: 90 }, sample: [], maxAudienceSize: 500, tooLarge: false })
    );
    await open(page, "/enrichment/people");
    await expect(page.getByText("No people match")).toBeVisible();
    await open(page, "/enrichment/campaigns");
    await expect(page.getByText("No job changes are waiting for review.")).toBeVisible();
    await expect(page.getByText(/No campaigns yet\. Build an audience above/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save audience and draft campaign" })).toBeDisabled();
    await open(page, "/enrichment/add");
    await expect(page.getByText(/No runs yet\. Add a LinkedIn URL above/)).toBeVisible();
    await open(page, "/enrichment/providers");
    await expect(page.getByText(/No provider account is connected/)).toBeVisible();
  });

  test("a record that is gone says so instead of failing", async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/v1/enrichment/people/p-gone", (route) => json(route, { error: "person_not_found" }, 404));
    await page.route(`**/api/v1/enrichment/campaigns/${CAMPAIGN}`, (route) => json(route, { ok: false, code: "campaign_not_found", error: "This campaign does not exist in your workspace." }, 404));
    await open(page, "/enrichment/people/p-gone");
    await expect(page.getByText(/This person is not in the workspace/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Back to people" })).toBeVisible();
    await open(page, `/enrichment/campaigns/${CAMPAIGN}`);
    await expect(page.getByText("This campaign is not in the workspace.")).toBeVisible({ timeout: 30_000 });
  });

  test("a workspace outside the internal release sees why, on every enrichment screen", async ({ page }) => {
    await mockApi(page, { released: false });
    for (const path of ["/enrichment/people", "/enrichment/companies", "/enrichment/capture", "/enrichment/campaigns", "/enrichment/providers", "/enrichment/add"]) {
      await open(page, path);
      await expect(page.getByTestId("enrichment-not-released"), path).toContainText("internal release and is not enabled for this workspace");
    }
  });
});
