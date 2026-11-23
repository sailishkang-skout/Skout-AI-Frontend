import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyJobRoles } from "./company-job-roles";
import { CaptureVerificationCard } from "./capture-verification-card";
import { postedLabel, safeJobUrl, scanExplanation, timeAgo, type CompanyJobs, type JobRole, type JobScan } from "@/lib/company-jobs";

const { mockApiFetch, mockHasPermission } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
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
    useAuthReady: () => true,
    formatQueryError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  };
});
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ hasPermission: mockHasPermission }) }));

const NOW = new Date().toISOString();
const job = (n: number, overrides: Partial<JobRole> = {}): JobRole => ({
  id: `job-${n}`,
  title: `Role ${n}`,
  companyName: "Acme",
  department: null,
  location: "Austin, TX",
  country: "United States",
  employmentType: null,
  workplaceType: null,
  description: null,
  requirements: null,
  postedAt: null,
  postedText: null,
  jobUrl: `https://www.linkedin.com/jobs/view/40100${n}/`,
  jobId: `40100${n}`,
  source: "linkedin_extension",
  status: "open",
  detailsComplete: false,
  firstDetectedAt: NOW,
  lastSeenAt: NOW,
  lastVerifiedAt: NOW,
  changedAt: null,
  isNew: false,
  isUpdated: false,
  ...overrides,
});
const scan = (status: JobScan["status"], overrides: Partial<JobScan> = {}): JobScan => ({
  id: "scan-1",
  status,
  state: status,
  source: "company-jobs-tab+job-search",
  passes: 2,
  jobsFound: 3,
  jobsNew: 1,
  jobsUpdated: 0,
  verified: status === "completed_verified",
  details: { notes: [] },
  error: null,
  requestedAt: null,
  startedAt: NOW,
  completedAt: NOW,
  createdAt: NOW,
  ...overrides,
});
const data = (overrides: Partial<CompanyJobs> = {}): CompanyJobs => ({ jobs: [], total: 0, notSeen: 0, lastScan: null, activeScan: null, scans: [], ...overrides });

function serve(response: CompanyJobs | Error, { rescan = { scan: scan("requested", { state: "requested" }), alreadyRequested: false } } = {}) {
  mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return rescan;
    if (response instanceof Error) throw response;
    return response;
  });
}
function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CompanyJobRoles companyId="co-1" companyName="Acme" />
    </QueryClientProvider>
  );
}

describe("CompanyJobRoles", () => {
  beforeEach(() => mockHasPermission.mockReturnValue(true));
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls the API's real /api/v1 path", async () => {
    serve(data());
    renderIt();
    await screen.findByTestId("job-roles-empty");
    expect(mockApiFetch.mock.calls[0]![0]).toBe("/api/v1/enrichment/companies/co-1/jobs?includeNotSeen=false&limit=200");
  });

  it("lists the roles in the order the API gave (newest first) with total, last scan and per-role facts", async () => {
    serve(data({
      total: 3,
      jobs: [
        job(1, { isNew: true, workplaceType: "remote", employmentType: "Full-time", department: "Engineering", postedAt: "2026-11-10T09:00:00.000Z" }),
        job(2, { isUpdated: true, postedText: "3 days ago" }),
        job(3),
      ],
      lastScan: scan("completed_verified"),
    }));
    renderIt();
    const list = await screen.findByRole("list", { name: "Job roles, newest first" });
    const rows = within(list).getAllByTestId("job-role");
    expect(rows.map((row) => within(row).getByText(/^Role \d$/).textContent)).toEqual(["Role 1", "Role 2", "Role 3"]);
    expect(within(rows[0]!).getByText("New")).toBeTruthy();
    expect(within(rows[0]!).getByText("Austin, TX · Engineering · Full-time · Remote")).toBeTruthy();
    expect(within(rows[0]!).getByText(/Posted Nov 10, 2026/)).toBeTruthy();
    expect(within(rows[1]!).getByText("Updated")).toBeTruthy();
    expect(within(rows[1]!).getByText("Posted 3 days ago")).toBeTruthy();
    expect(screen.getByLabelText("3 open roles")).toBeTruthy();
    expect(screen.getByText("Completed & verified")).toBeTruthy();
    expect(screen.getByText("Two scans agreed on 3 roles.")).toBeTruthy();
    expect(within(rows[0]!).getByRole("link", { name: "Role 1" }).getAttribute("href")).toBe("https://www.linkedin.com/jobs/view/401001/");
  });

  it("shows a role's description, requirements and dates on request, and never invents what is missing", async () => {
    serve(data({ total: 2, jobs: [job(1, { description: "Build the billing platform.", requirements: "5+ years of TypeScript" }), job(2)], lastScan: scan("completed_verified") }));
    renderIt();
    const rows = await screen.findAllByTestId("job-role");
    expect(within(rows[1]!).queryByRole("button", { name: /Show details/ })).toBeNull();
    fireEvent.click(within(rows[0]!).getByRole("button", { name: "Show details" }));
    expect(within(rows[0]!).getByText("Build the billing platform.", { selector: "p.whitespace-pre-line" })).toBeTruthy();
    expect(within(rows[0]!).getByText("5+ years of TypeScript")).toBeTruthy();
    expect(within(rows[0]!).getByText(/First detected:/)).toBeTruthy();
    expect(within(rows[0]!).getByText(/Last verified:/)).toBeTruthy();
    expect(within(rows[0]!).getByText("Status: Open in the latest verified scan")).toBeTruthy();
  });

  it("never links anything but a LinkedIn job page", async () => {
    serve(data({ total: 1, jobs: [job(1, { jobUrl: "javascript:alert(1)" })], lastScan: scan("completed_verified") }));
    renderIt();
    const row = await screen.findByTestId("job-role");
    expect(within(row).queryByRole("link")).toBeNull();
    expect(safeJobUrl("https://evil.example/jobs/view/1/")).toBeNull();
    expect(safeJobUrl("http://www.linkedin.com/jobs/view/1/")).toBeNull();
    expect(safeJobUrl("https://www.linkedin.com/jobs/view/1/")).toBe("https://www.linkedin.com/jobs/view/1/");
  });

  it("offers roles that were not seen in recent scans on request, and never calls them closed", async () => {
    serve(data({ total: 1, notSeen: 2, jobs: [job(1)], lastScan: scan("completed_verified") }));
    renderIt();
    fireEvent.click(await screen.findByLabelText(/Also show 2 roles not seen in recent scans/));
    await waitFor(() => expect(mockApiFetch.mock.calls.at(-1)![0]).toContain("includeNotSeen=true"));
    expect(screen.queryByText(/closed/i)).toBeNull();
  });

  it("explains an empty list by what the scans can honestly say", async () => {
    serve(data());
    const view = renderIt();
    expect(await screen.findByText("No job roles captured yet")).toBeTruthy();
    view.unmount();
    serve(data({ lastScan: scan("not_found", { jobsFound: 0 }) }));
    const second = renderIt();
    expect(await screen.findByText("No open roles (confirmed)")).toBeTruthy();
    expect(screen.getByText("Two complete scans found no open roles.", { selector: "p.text-muted-foreground:not(.text-center)" })).toBeTruthy();
    second.unmount();
    serve(data({ lastScan: scan("not_loaded", { jobsFound: 0, state: "not_loaded" }) }));
    renderIt();
    expect(await screen.findByText("No job roles to show")).toBeTruthy();
    expect(screen.getByText("Not loaded")).toBeTruthy();
    expect(screen.queryByText(/confirmed/)).toBeNull();
  });

  it("says plainly when a scan failed, was restricted, or could not verify the list", () => {
    expect(scanExplanation(scan("failed", { error: "Timed out" }))).toBe("The scan failed: Timed out");
    expect(scanExplanation(scan("restricted"))).toMatch(/LinkedIn restricted the page/);
    expect(scanExplanation(scan("verification_required"))).toMatch(/could not confirm/);
    expect(scanExplanation(scan("partial"))).toMatch(/Only part of the list/);
    expect(scanExplanation(scan("in_progress", { state: "interrupted" }))).toMatch(/stopped reporting/);
  });

  it("shows the scan's own notes, and a scan that was requested or is running", async () => {
    serve(data({
      lastScan: scan("partial", { details: { notes: ["Verification stopped after 8 result pages (200 roles); more may exist."] } }),
      activeScan: scan("requested", { state: "requested", completedAt: null, jobsFound: 0 }),
    }));
    renderIt();
    expect(await screen.findByText(/Verification stopped after 8 result pages/)).toBeTruthy();
    expect(screen.getByTestId("job-scan-active")).toBeTruthy();
    expect(screen.getByText(/Waiting for the extension/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Scan requested" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requests a rescan and tells the user where to start it", async () => {
    serve(data({ total: 1, jobs: [job(1)], lastScan: scan("completed_verified") }));
    renderIt();
    fireEvent.click(await screen.findByRole("button", { name: "Rescan" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/companies/co-1/jobs/rescan", { method: "POST" }));
    expect(await screen.findByText(/Rescan requested for Acme/)).toBeTruthy();
    expect(screen.getByText(/start it under Job roles/)).toBeTruthy();
  });

  it("hides the rescan from members who cannot capture", async () => {
    mockHasPermission.mockReturnValue(false);
    serve(data({ total: 1, jobs: [job(1)], lastScan: scan("completed_verified") }));
    renderIt();
    await screen.findByTestId("job-role");
    expect(screen.queryByRole("button", { name: /Rescan/ })).toBeNull();
  });

  it("shows a clear error with retry, and a loading state", async () => {
    serve(new Error("Request failed (500)"));
    renderIt();
    expect(screen.getByLabelText("Loading job roles")).toBeTruthy();
    expect(await screen.findByText("Request failed (500)")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again|Retry/i })).toBeTruthy();
  });

  it("formats dates and ages", () => {
    expect(postedLabel({ postedAt: "2026-11-10T09:00:00.000Z", postedText: "3 days ago" }, "en-US")).toBe("Nov 10, 2026");
    expect(postedLabel({ postedAt: null, postedText: "3 days ago" })).toBe("3 days ago");
    expect(postedLabel({ postedAt: null, postedText: null })).toBeNull();
    expect(timeAgo(new Date(Date.now() - 2 * 3600_000).toISOString())).toBe("2 h ago");
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });
});

describe("CaptureVerificationCard", () => {
  afterEach(cleanup);

  it("shows the verdict, each section against what LinkedIn shows, and what was not found", () => {
    render(
      <CaptureVerificationCard
        subject="profile"
        verification={{
          status: "partial",
          passes: 2,
          sections: { skills: { found: 12, expected: 27, state: "incomplete" }, education: { found: 2, state: "complete" }, experience: { found: 0, state: "none" } },
          missing: ["Phone", "Website / portfolio"],
          notes: ["Skills: captured 12 of 27.", "Verification of /in/jane/details/skills/: took too long."],
          verifiedAt: new Date().toISOString(),
        }}
      />
    );
    expect(screen.getByText("Partial capture")).toBeTruthy();
    expect(screen.getByText("2 scans · just now")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Verified sections" });
    expect(within(list).getByText("Skills").parentElement!.textContent).toContain("12 of 27");
    expect(within(list).getByText("Short of what LinkedIn shows")).toBeTruthy();
    expect(within(list).getByText("None on LinkedIn (confirmed)")).toBeTruthy();
    expect(screen.getByText("Phone, Website / portfolio")).toBeTruthy();
    // The per-section note is not repeated; other notes are kept.
    expect(screen.queryByText("Skills: captured 12 of 27.")).toBeNull();
    expect(screen.getByText(/took too long/)).toBeTruthy();
  });

  it("says an older capture has no verification, instead of showing nothing", () => {
    render(<CaptureVerificationCard subject="company" verification={null} />);
    expect(screen.getByText(/captured before verification scans existed/)).toBeTruthy();
  });

  it("uses the same statuses for a verified capture", () => {
    render(<CaptureVerificationCard subject="company" verification={{ status: "verified", passes: 2, sections: { people: { found: 40, state: "complete" }, jobs: { found: 0, state: "none" } } }} />);
    expect(screen.getByText("Completed & verified")).toBeTruthy();
    expect(screen.getByText("Job roles")).toBeTruthy();
  });
});
