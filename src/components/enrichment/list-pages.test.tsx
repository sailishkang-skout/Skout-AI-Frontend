import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanySummary, PersonSummary } from "@/lib/enrichment-research";
import { parseLinkedinUrl } from "@/lib/linkedin-url";
import { CompaniesList } from "./companies-list";
import { PeopleList } from "./people-list";

const { mockApiFetch, mockHasPermission, mockRouter } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
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
    useApiFetchBlob: () => vi.fn(),
    useAuthReady: () => true,
    formatQueryError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  };
});
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ hasPermission: mockHasPermission }) }));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const person = (id: string, name: string | null, extra: Partial<PersonSummary> = {}): PersonSummary => ({
  prospectId: id, contactId: null, fullName: name, headline: "Head of Revenue", title: "Head of Revenue", companyId: null, companyName: "Initech",
  location: "Pune, India", linkedinUrl: `https://www.linkedin.com/in/${id}/`, salesNavigatorLeadUrl: null, identity: "public_profile", employmentState: "verified",
  seniority: null, jobFunction: null, captureSource: "linkedin-public-profile", sourceUrl: null, capturedAt: "2026-10-06T09:00:00.000Z", pendingCapture: false, ...extra,
});
const co = (id: string, name: string, extra: Partial<CompanySummary> = {}): CompanySummary => ({
  id, name, domain: `${name.toLowerCase()}.example`, industry: "Software", employeeCount: 100, location: "Austin, TX", updatedAt: "2026-10-06T09:00:00.000Z",
  verifiedEmployees: 1, discoveryCandidates: 2, openRoles: 3, ...extra,
});
const overview = { people: { total: 140, verifiedEmployment: 90, discoveryCandidates: 50, publicProfiles: 120, salesNavigatorOnly: 20 }, companies: { total: 31 }, jobChanges: { pendingReview: 0 }, captures: { runsLast7Days: 6, leadsLast7Days: 480 } };

function serve(handlers: { people?: PersonSummary[]; companies?: CompanySummary[]; total?: number }) {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url.includes("/overview")) return overview;
    if (url.includes("/people")) return { people: handlers.people ?? [], total: handlers.total ?? handlers.people?.length ?? 0, page: 1, pageSize: 25 };
    if (url.includes("/companies")) return { companies: handlers.companies ?? [], total: handlers.total ?? handlers.companies?.length ?? 0, page: 1, pageSize: 25 };
    return {};
  });
}
function renderIt(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const names = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("link")[0]!.textContent);

beforeEach(() => mockHasPermission.mockReturnValue(true));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("parseLinkedinUrl", () => {
  it("recognises a person or company and cleans the link", () => {
    expect(parseLinkedinUrl("https://www.linkedin.com/in/priya-raman/?utm_source=share&trk=x")).toEqual({ ok: true, kind: "person", slug: "priya-raman", url: "https://www.linkedin.com/in/priya-raman/" });
    expect(parseLinkedinUrl("linkedin.com/company/acme/jobs/")).toEqual({ ok: true, kind: "company", slug: "acme", url: "https://www.linkedin.com/company/acme/" });
    expect(parseLinkedinUrl("https://in.linkedin.com/in/jo/details/skills/")).toMatchObject({ ok: true, kind: "person", slug: "jo" });
  });

  it("says why a link cannot be used", () => {
    expect(parseLinkedinUrl("")).toMatchObject({ ok: false, reason: expect.stringMatching(/Paste a LinkedIn/) });
    expect(parseLinkedinUrl("https://example.com/in/jo/")).toMatchObject({ ok: false, reason: expect.stringMatching(/Only linkedin.com/) });
    expect(parseLinkedinUrl("https://www.linkedin.com/sales/lead/abc")).toMatchObject({ ok: false, reason: expect.stringMatching(/Sales Navigator/) });
    expect(parseLinkedinUrl("https://www.linkedin.com/jobs/view/123/")).toMatchObject({ ok: false, reason: expect.stringMatching(/not a person or company/) });
    expect(parseLinkedinUrl("https://www.linkedin.com/school/mit/")).toMatchObject({ ok: false });
    expect(parseLinkedinUrl("not a link at all")).toMatchObject({ ok: false });
  });
});

describe("People page", () => {
  it("shows workspace totals, a table of people and a LinkedIn link", async () => {
    serve({ people: [person("priya", "Priya Raman"), person("alex", "Alex Kim", { companyName: "Hooli", pendingCapture: true })], total: 140 });
    renderIt(<PeopleList />);
    expect(await screen.findByText("Priya Raman")).toBeTruthy();
    const stats = screen.getByTestId("stat-grid");
    expect(within(stats).getByText("140")).toBeTruthy();
    expect(within(stats).getByText("90")).toBeTruthy();
    expect(within(stats).getByText("20 Sales Navigator only")).toBeTruthy();
    expect(screen.getByTestId("results-bar").textContent).toContain("Showing 2 of 140 people");
    expect(screen.getByText("Needs capture")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Priya Raman on LinkedIn" }).getAttribute("href")).toBe("https://www.linkedin.com/in/priya/");
  });

  it("sorts the people on the page by name, both ways", async () => {
    serve({ people: [person("b", "Bea"), person("c", "Cy"), person("a", "Ana")] });
    renderIt(<PeopleList />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: /^Person/ }));
    expect(names()).toEqual(["Ana", "Bea", "Cy"]);
    fireEvent.click(screen.getByRole("button", { name: /^Person/ }));
    expect(names()).toEqual(["Cy", "Bea", "Ana"]);
  });

  it("offers Clear filters when a filter hides everything, and clears them", async () => {
    serve({ people: [] });
    renderIt(<PeopleList />);
    fireEvent.change(screen.getByLabelText("Search people"), { target: { value: "zzz" } });
    expect(await screen.findByText("No people match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect((screen.getByLabelText("Search people") as HTMLInputElement).value).toBe("");
  });

  it("shows an error with a retry", async () => {
    mockApiFetch.mockRejectedValue(new Error("Request failed (500)"));
    renderIt(<PeopleList />);
    expect(await screen.findByText("Request failed (500)")).toBeTruthy();
  });

  it("shows what a pasted link is before it is added, and refuses one it cannot use", async () => {
    serve({ people: [] });
    renderIt(<PeopleList />);
    fireEvent.click(screen.getByRole("button", { name: /Add LinkedIn URL/ }));
    const input = await screen.findByLabelText("LinkedIn URL");
    fireEvent.change(input, { target: { value: "https://www.linkedin.com/sales/lead/abc" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Sales Navigator/);
    expect((screen.getByRole("button", { name: "Add URL" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "https://www.linkedin.com/company/acme/?trk=x" } });
    expect(screen.getByTestId("url-detected").textContent).toContain("https://www.linkedin.com/company/acme/");
    expect(screen.getByTestId("url-detected").textContent).toContain("Company");
    mockApiFetch.mockImplementationOnce(async () => ({ kind: "company", companyId: "c-1", created: true }));
    fireEvent.click(screen.getByRole("button", { name: "Add URL" }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/enrichment/companies/c-1"));
    // The cleaned address is what was sent.
    const sent = mockApiFetch.mock.calls.find((call) => String(call[0]).includes("linkedin-urls"));
    expect(JSON.parse(sent![1].body)).toEqual({ url: "https://www.linkedin.com/company/acme/" });
  });
});

describe("Companies page", () => {
  it("shows totals and a table with verified, candidate and open-role counts", async () => {
    serve({ companies: [co("1", "Acme"), co("2", "Zed", { openRoles: undefined })] });
    renderIt(<CompaniesList />);
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(within(screen.getByTestId("stat-grid")).getByText("31")).toBeTruthy();
    expect(screen.getAllByText("1 verified")).toHaveLength(2);
    expect(screen.getByText("3 open roles")).toBeTruthy();
  });

  it("sorts by open roles and by name", async () => {
    serve({ companies: [co("1", "Beta", { openRoles: 2 }), co("2", "Alpha", { openRoles: 9 }), co("3", "Gamma", { openRoles: 5 })] });
    renderIt(<CompaniesList />);
    await screen.findByText("Beta");
    expect(names()).toEqual(["Alpha", "Beta", "Gamma"]);
    fireEvent.click(screen.getByRole("button", { name: /^Open roles/ }));
    expect(names()).toEqual(["Alpha", "Gamma", "Beta"]);
  });

  it("clears an empty search", async () => {
    serve({ companies: [] });
    renderIt(<CompaniesList />);
    fireEvent.change(screen.getByLabelText("Search companies"), { target: { value: "nope" } });
    expect(await screen.findByText("No companies match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((screen.getByLabelText("Search companies") as HTMLInputElement).value).toBe("");
  });
});
