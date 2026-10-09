import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyDetail, EvidenceFact, JobChange, PersonDetail, PersonSummary } from "@/lib/enrichment-research";
import { CompanyDetailView } from "./company-detail";
import { EvidenceBadge } from "./evidence-badge";
import { JobChanges } from "./job-changes";
import { PeopleList } from "./people-list";
import { PersonDetailView } from "./person-detail";

const { mockApiFetch, mockApiFetchBlob, mockHasPermission, mockRouter } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockApiFetchBlob: vi.fn(),
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
  mockRouter: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    constructor(message: string, public status: number, public body?: unknown) {
      super(message);
    }
  }
  return {
    ApiError,
    useApiFetch: () => mockApiFetch,
    useApiFetchBlob: () => mockApiFetchBlob,
    useAuthReady: () => true,
    formatQueryError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  };
});
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ hasPermission: mockHasPermission }) }));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const fact = (attribute: string, overrides: Partial<EvidenceFact> = {}): EvidenceFact => ({
  evidenceId: `ev-${attribute}-${overrides.state ?? "verified"}`,
  attribute,
  value: "x",
  source: "linkedin_public_profile",
  sourceUrl: "https://www.linkedin.com/in/priya-raman/",
  observedAt: "2026-10-06T09:00:00.000Z",
  capturedAt: "2026-10-06T09:00:00.000Z",
  confidence: 0.9,
  state: "verified",
  method: "extension_rendered_dom",
  freshnessExpiresAt: "2027-01-04T09:00:00.000Z",
  stale: false,
  usableForClaims: true,
  ...overrides,
});

const summary = (overrides: Partial<PersonSummary> = {}): PersonSummary => ({
  prospectId: "p1",
  contactId: "c1",
  fullName: "Priya Raman",
  headline: "Head of Revenue at Initech",
  title: "Head of Revenue",
  companyId: "11111111-1111-4111-8111-111111111111",
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
  capturedAt: "2026-10-06T09:00:00.000Z",
  pendingCapture: false,
  ...overrides,
});

const DISPLAYED = ["fullName", "headline", "employment", "locationName", "summary", "currentCompanies", "previousCompanies", "educations", "skills", "relationshipContext"];

const person = (overrides: Partial<PersonDetail> = {}): PersonDetail => ({
  ...summary(),
  summary: "Runs revenue operations.",
  connectionsCount: 500,
  followersCount: 1200,
  relationshipContext: { degree: 2, mutualConnectionsText: "12 mutual connections" },
  experience: {
    current: [{ name: "Initech", title: "Head of Revenue", dates: "Mar 2024 - Present" }],
    previous: [{ name: "Hooli", title: "Sales Manager", dates: "2020 - 2024" }],
  },
  educations: [{ school: "IIT Bombay", degree: "B.Tech" }],
  skills: [{ name: "Revenue Operations", endorsements: 8 }],
  certifications: [],
  languages: [],
  companyDomain: "initech.example",
  identityKeys: ["in:priya-raman"],
  candidateCompanies: [],
  facts: DISPLAYED.map((attribute) => fact(attribute)),
  evidence: [fact("headline"), fact("headline", { state: "discovery", source: "sales_navigator_search_result", confidence: 0.5 })],
  changes: [
    {
      id: "ch1",
      field: "currentCompanies",
      changeType: "FIELD_UPDATED",
      oldValue: [{ name: "Hooli", title: "Sales Manager" }],
      newValue: [{ name: "Initech", title: "Head of Revenue" }],
      isJobChange: true,
      detectedAt: "2026-10-06T09:00:00.000Z",
      reviewedAt: null,
    },
  ],
  freshness: { capturedAt: "2026-10-06T09:00:00.000Z", stale: false },
  ...overrides,
});

const company = (): CompanyDetail => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Initech",
  domain: "initech.example",
  industry: "Software",
  employeeCount: 412,
  location: "Austin, Texas",
  updatedAt: "2026-10-06T09:00:00.000Z",
  linkedinUrl: "https://www.linkedin.com/company/initech/",
  capture: {
    capturedAt: "2026-10-06T09:00:00.000Z",
    sourceUrl: "https://www.linkedin.com/company/initech/about/",
    tagline: "Software that works.",
    overview: "Initech builds software.",
    website: "https://www.initech.example",
    size: "201-500",
    headquarter: "Austin, Texas",
    foundedAt: "1999",
    specialties: [],
    followers: 1000,
    openJobs: 3,
    sections: ["about"],
  },
  people: { visibleAssociatedMembers: 412, verifiedEmployees: 1, discoveryCandidates: 20 },
  facts: ["name", "website", "industry", "headquarter", "size", "employeesOnLi", "overview"].map((attribute) =>
    fact(attribute, { source: "linkedin_company_page", confidence: 0.85, sourceUrl: "https://www.linkedin.com/company/initech/about/" })
  ),
  evidence: [],
  changes: [],
  freshness: { capturedAt: "2026-10-06T09:00:00.000Z", stale: false },
});

const jobChange = (overrides: Partial<JobChange> = {}): JobChange => ({
  id: "22222222-2222-4222-8222-222222222222",
  field: "currentCompanies",
  changeType: "FIELD_UPDATED",
  oldValue: null,
  newValue: null,
  isJobChange: true,
  detectedAt: "2026-10-07T09:00:00.000Z",
  reviewedAt: null,
  prospectId: "p1",
  fullName: "Priya Raman",
  sourceUrl: "https://www.linkedin.com/in/priya-raman/",
  from: { company: "Initech", title: "Head of Revenue" },
  to: { company: "Umbrella", title: "VP Revenue" },
  requiresReview: true,
  ...overrides,
});

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => mockHasPermission.mockReturnValue(true));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EvidenceBadge", () => {
  it("shows source, capture time and confidence, with a link to the source", () => {
    render(<EvidenceBadge fact={fact("headline")} />);
    const badge = screen.getByTestId("evidence-badge");
    expect(badge.textContent).toMatch(/LinkedIn profile · captured .*2026.* · 90% confidence/);
    expect(badge.getAttribute("data-state")).toBe("verified");
    expect(within(badge).getByRole("link").getAttribute("href")).toBe("https://www.linkedin.com/in/priya-raman/");
  });

  it("marks discovery-only, stale and unsourced facts", () => {
    const { rerender } = render(<EvidenceBadge fact={fact("headline", { state: "discovery", source: "sales_navigator_search_result", confidence: 0.5, stale: true })} />);
    const badge = screen.getByTestId("evidence-badge");
    expect(badge.getAttribute("data-state")).toBe("discovery");
    expect(badge.textContent).toMatch(/Sales Navigator search card .* 50% confidence/);
    expect(within(badge).getByText("Stale")).toBeTruthy();
    rerender(<EvidenceBadge fact={undefined} />);
    expect(screen.getByTestId("evidence-badge").textContent).toBe("No recorded source");
  });
});

describe("PersonDetailView", () => {
  it("puts an evidence badge with source and capture time on every displayed fact", async () => {
    mockApiFetch.mockResolvedValue({ person: person() });
    renderWithClient(<PersonDetailView prospectId="p1" />);
    expect(await screen.findByRole("heading", { name: "Priya Raman" })).toBeTruthy();
    for (const section of ["Experience", "Education", "Skills", "Relationship context", "About"]) {
      expect(screen.getByRole("heading", { name: section })).toBeTruthy();
    }
    expect(screen.getByText("Sales Manager")).toBeTruthy();
    expect(screen.getByText("IIT Bombay")).toBeTruthy();
    expect(screen.getByText("12 mutual connections")).toBeTruthy();

    const badges = screen.getAllByTestId("evidence-badge");
    // 4 header facts, About, Experience (current, past), Education, Skills, Relationship, and 2 evidence rows.
    expect(badges.length).toBe(12);
    expect(badges.every((badge) => badge.getAttribute("data-state") !== "missing")).toBe(true);
    expect(badges.every((badge) => /captured .*2026/.test(badge.textContent ?? ""))).toBe(true);
    expect(screen.getByText("Verified employee")).toBeTruthy();
    expect(screen.getByText("Job change")).toBeTruthy();
    expect(screen.getByText("Sales Manager at Hooli → Head of Revenue at Initech")).toBeTruthy();
    // A public-profile record has nothing to attach.
    expect(screen.queryByRole("button", { name: "Attach URL" })).toBeNull();
  });

  it("labels a discovered candidate and lets a Sales lead get a real public URL attached", async () => {
    const lead = person({
      ...summary({ identity: "sales_lead", linkedinUrl: null, salesNavigatorLeadUrl: "https://www.linkedin.com/sales/lead/abc,NAME_SEARCH,x", employmentState: "candidate" }),
      facts: [fact("employment", { state: "discovery", source: "sales_navigator_search_result", confidence: 0.5 })],
    });
    mockApiFetch.mockImplementation(async (url: string) =>
      url.endsWith("/public-url") ? { prospectId: "p-merged", linkedinUrl: "https://www.linkedin.com/in/priya-raman/", merged: true } : { person: lead }
    );
    renderWithClient(<PersonDetailView prospectId="p1" />);
    expect(await screen.findByText("Discovered candidate")).toBeTruthy();
    expect(screen.getByText(/Not confirmed by this person's own profile/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open Sales Navigator lead/ })).toBeTruthy();
    // The name has no ledger row in this fixture, and the page says so rather than implying a source.
    expect(screen.getAllByText("No recorded source").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Public LinkedIn profile URL"), { target: { value: " https://www.linkedin.com/in/priya-raman/ " } });
    fireEvent.click(screen.getByRole("button", { name: "Attach URL" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/enrichment/people/p1/public-url",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ url: "https://www.linkedin.com/in/priya-raman/" }) })
      )
    );
    // The lead was merged into the existing record, so the page follows it.
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/enrichment/people/p-merged"));
  });

  it("re-enriches, downloads CSV and deletes after confirmation; actions are hidden without permission", async () => {
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/enrich")) return { jobId: "job-12345678", status: "queued" };
      if (init?.method === "DELETE") return { success: true };
      return { person: person() };
    });
    mockApiFetchBlob.mockResolvedValue(new Blob(["id"]));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const { unmount } = renderWithClient(<PersonDetailView prospectId="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Re-enrich/ }));
    expect(await screen.findByText(/Re-enrichment queued \(job job-1234, queued\)/)).toBeTruthy();
    expect(JSON.parse(String(mockApiFetch.mock.calls.find(([url]) => String(url).endsWith("/enrich"))![1].body)).prospect).toMatchObject({ prospectId: "p1", companyDomain: "initech.example" });

    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    await waitFor(() => expect(mockApiFetchBlob).toHaveBeenCalledWith("/api/v1/enrichment/people/p1/export.csv"));

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/v1/enrichment/people/p1", expect.objectContaining({ method: "DELETE" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete record" }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/enrichment/people"));

    unmount();
    mockHasPermission.mockReturnValue(false);
    renderWithClient(<PersonDetailView prospectId="p1" />);
    await screen.findByRole("heading", { name: "Priya Raman" });
    for (const name of [/Re-enrich/, /CSV/, /Delete/]) expect(screen.queryByRole("button", { name })).toBeNull();
  });
});

describe("CompanyDetailView", () => {
  const candidates = Array.from({ length: 15 }, (_, index) => ({
    ...summary({ prospectId: `cand-${index}`, fullName: `Candidate ${index}`, employmentState: "candidate" }),
    discoverySource: "sales-navigator-search-result",
    discoveredAt: "2026-10-06T09:00:00.000Z",
  }));

  beforeEach(() => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.includes("/people?")) {
        const params = new URLSearchParams(url.split("?")[1]);
        if (params.get("group") === "verified") {
          return { group: "verified", people: [{ ...summary(), discoverySource: null, discoveredAt: null }], total: 1, page: 1, pageSize: 15 };
        }
        const page = Number(params.get("page") ?? 1);
        return { group: "candidates", people: page === 1 ? candidates : candidates.slice(0, 5), total: 20, page, pageSize: 15 };
      }
      return { company: company() };
    });
  });

  it("shows verified employees and discovered candidates as separate, clearly labelled lists", async () => {
    renderWithClient(<CompanyDetailView companyId="11111111-1111-4111-8111-111111111111" />);
    expect(await screen.findByRole("heading", { name: "Initech" })).toBeTruthy();
    const verified = await screen.findByTestId("company-people-verified");
    const discovered = screen.getByTestId("company-people-candidates");
    expect(await within(verified).findByText("Priya Raman")).toBeTruthy();
    expect(within(verified).getByText(/Confirmed by a capture of the person's own public profile/)).toBeTruthy();
    expect(await within(discovered).findByText("Candidate 0")).toBeTruthy();
    expect(within(discovered).getByText(/can include former employees/)).toBeTruthy();
    expect(within(discovered).queryByText("Priya Raman")).toBeNull();
    expect(within(verified).queryByText("Candidate 0")).toBeNull();

    // Company facts carry their source; the member count is explained.
    expect(screen.getByText("412")).toBeTruthy();
    expect(screen.getByText(/not the number of records that can be captured/)).toBeTruthy();
    const badges = screen.getAllByTestId("evidence-badge");
    expect(badges.length).toBe(7);
    expect(badges.every((badge) => /LinkedIn company page · captured/.test(badge.textContent ?? ""))).toBe(true);
    expect(screen.getByText(/at most 10 pages or 250 leads/)).toBeTruthy();
  });

  it("pages candidates 15 at a time and filters by department", async () => {
    renderWithClient(<CompanyDetailView companyId="11111111-1111-4111-8111-111111111111" />);
    const discovered = await screen.findByTestId("company-people-candidates");
    expect(await within(discovered).findByText("1–15 of 20")).toBeTruthy();
    expect(within(discovered).getAllByRole("listitem")).toHaveLength(15);
    fireEvent.click(within(discovered).getByRole("button", { name: "Next" }));
    expect(await within(discovered).findByText("16–20 of 20")).toBeTruthy();
    expect(mockApiFetch).toHaveBeenCalledWith(expect.stringMatching(/\/people\?page=2&group=candidates$/));

    fireEvent.change(within(discovered).getByLabelText("Department filter for Discovered candidates"), { target: { value: "Sales" } });
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(expect.stringMatching(/\/people\?page=1&department=Sales&group=candidates$/)));
  });
});

describe("JobChanges", () => {
  it("lists changes for review, states that nothing is sent, and marks one reviewed", async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url.endsWith("/review") ? { jobChange: {} } : { jobChanges: [jobChange()], total: 1, page: 1, pageSize: 25 }
    );
    renderWithClient(<JobChanges />);
    expect(await screen.findByText("Priya Raman")).toBeTruthy();
    expect(screen.getByText("Head of Revenue at Initech")).toBeTruthy();
    expect(screen.getByText("VP Revenue at Umbrella")).toBeTruthy();
    expect(screen.getByText(/does not message anyone or change an enrollment/)).toBeTruthy();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/job-changes?status=pending&page=1");
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/job-changes/22222222-2222-4222-8222-222222222222/review", expect.objectContaining({ method: "POST" }))
    );
  });
});

describe("PeopleList", () => {
  it("filters, labels verified vs candidate, and adds a LinkedIn URL", async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith("/linkedin-urls")) return { kind: "person", prospectId: "p-new", created: true };
      return { people: [summary(), summary({ prospectId: "p2", fullName: null, pendingCapture: true, employmentState: "candidate", identity: "sales_lead" })], total: 2, page: 1, pageSize: 25 };
    });
    renderWithClient(<PeopleList />);
    expect(await screen.findByText("Priya Raman")).toBeTruthy();
    expect(screen.getByText("Not captured yet")).toBeTruthy();
    expect(screen.getByText("Verified employee")).toBeTruthy();
    expect(screen.getByText("Discovered candidate")).toBeTruthy();
    expect(screen.getByText("Sales Navigator lead")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Employment"), { target: { value: "candidate" } });
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/people?page=1&state=candidate"));

    fireEvent.click(screen.getByRole("button", { name: /Add LinkedIn URL/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("LinkedIn URL"), { target: { value: "https://www.linkedin.com/in/new-person/" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add URL" }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/enrichment/people/p-new"));
  });
});
