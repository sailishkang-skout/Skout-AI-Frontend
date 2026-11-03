import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendBlockedReason, type AudiencePreview, type Campaign, type CampaignDetail, type Claim, type Recipient } from "@/lib/enrichment-campaigns";
import { CampaignDetailView } from "./campaign-detail";
import { CampaignsHome } from "./campaigns-home";

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
    useAuthReady: () => true,
    formatQueryError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  };
});
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ hasPermission: mockHasPermission }) }));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  kind: "role",
  text: "I saw that you're Head of Revenue at Initech.",
  evidenceId: "ev-role",
  attribute: "employment",
  source: "linkedin_public_profile",
  sourceUrl: "https://www.linkedin.com/in/priya-raman/",
  capturedAt: "2026-10-06T09:00:00.000Z",
  observedAt: "2026-10-06T09:00:00.000Z",
  confidence: 0.9,
  state: "verified",
  stale: false,
  usable: true,
  excludedReason: null,
  ...overrides,
});
const companyClaim = claim({ kind: "company", text: "Initech is listed under Software Development.", evidenceId: "ev-industry", attribute: "industry", source: "linkedin_company_page", confidence: 0.85 });
const discoveryClaim = claim({ text: "I saw that you're Sales Director at Initech.", evidenceId: "ev-card", source: "sales_navigator_search_result", confidence: 0.5, state: "discovery", usable: false, excludedReason: "discovery_only" });

const recipient = (overrides: Partial<Recipient> = {}): Recipient => ({
  prospectId: "p1",
  fullName: "Priya Raman",
  email: "priya@initech.example",
  eligibility: "eligible",
  exclusionReason: null,
  exclusionMessage: null,
  emailVerification: "valid",
  consentStatus: "missing",
  suppressed: false,
  decision: "included",
  decisionComment: null,
  claims: { reason: claim(), talkingPoints: [companyClaim], flagged: [], opening: `${claim().text} ${companyClaim.text}` },
  enrolled: false,
  outcome: { sentAt: null, repliedAt: null, bouncedAt: null, unsubscribedAt: null },
  ...overrides,
});

const campaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Revenue leaders",
  status: "draft",
  trigger: "manual",
  audienceId: "aud-1",
  sequenceId: null,
  recipientCount: 3,
  consentBasis: null,
  reviewComment: null,
  createdBy: null,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  launchedAt: null,
  createdAt: "2026-10-12T09:00:00.000Z",
  updatedAt: "2026-10-12T09:00:00.000Z",
  ...overrides,
});

const RECIPIENTS = [
  recipient(),
  recipient({
    prospectId: "p2",
    fullName: "Lead Card",
    email: "lead@initech.example",
    claims: { reason: null, talkingPoints: [], flagged: [discoveryClaim], opening: "" },
  }),
  recipient({
    prospectId: "p3",
    fullName: "Sam Suppressed",
    email: "sam@initech.example",
    eligibility: "excluded",
    exclusionReason: "suppressed",
    exclusionMessage: "The address is on the workspace suppression list (unsubscribed or blocked)",
    suppressed: true,
    consentStatus: "active",
  }),
  recipient({ prospectId: "p4", fullName: "Uma Unverified", email: "uma@initech.example", eligibility: "excluded", exclusionReason: "email_not_verified", exclusionMessage: "The email has not been verified as valid", emailVerification: "unverified" }),
];

const detail = (overrides: Partial<CampaignDetail> = {}): CampaignDetail => ({
  campaign: campaign(),
  draft: {
    steps: [
      { order: 1, delayDays: 0, subject: "A quick question, {{firstName}}", body: "Hi {{firstName}},\n\n{{opening}}\n\nWe help revenue teams.\n\n{{senderName}}" },
      { order: 2, delayDays: 3, subject: "Re: following up", body: "Hi {{firstName}},\n\nFollowing up.\n\n{{senderName}}" },
    ],
  },
  problems: [],
  recipients: RECIPIENTS,
  counts: { total: 4, eligible: 2, excluded: 2, included: 2, withoutTalkingPoint: 1, consentMissing: 2 },
  outcomes: { enrolled: 0, sent: 0, replied: 0, bounced: 0, unsubscribed: 0 },
  reviews: [],
  sendEnabled: false,
  consentEnforced: false,
  sandbox: { active: true, allowedRecipients: ["@sandbox.example"] },
  openingToken: "{{opening}}",
  ...overrides,
});

const preview = (overrides: Partial<AudiencePreview["counts"]> = {}): AudiencePreview => ({
  counts: { total: 12, verifiedEmployment: 7, discoveryOnly: 5, fresh: 10, stale: 2, withEmail: 6, verifiedEmail: 4, suppressed: 1, freshnessDays: 90, ...overrides },
  sample: [
    {
      prospectId: "p1",
      contactId: "c1",
      fullName: "Priya Raman",
      headline: "Head of Revenue at Initech",
      title: "Head of Revenue",
      companyId: "co1",
      companyName: "Initech",
      location: "Pune, India",
      linkedinUrl: "https://www.linkedin.com/in/priya-raman/",
      salesNavigatorLeadUrl: null,
      identity: "public_profile",
      employmentState: "verified",
      seniority: null,
      jobFunction: null,
      captureSource: "linkedin-public-profile",
      sourceUrl: null,
      capturedAt: "2026-10-06T09:00:00.000Z",
      pendingCapture: false,
    },
  ],
  maxAudienceSize: 500,
  tooLarge: false,
});

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const calls = (match: (url: string) => boolean, method = "POST") =>
  mockApiFetch.mock.calls.filter(([url, init]) => match(String(url)) && (init?.method ?? "GET") === method).map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));
const count = (label: string) => within(screen.getByTestId(`count-${label}`)).getByText(/^\d+$/).textContent;

beforeEach(() => mockHasPermission.mockReturnValue(true));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CampaignsHome", () => {
  const home = (queue: unknown[] = [], campaigns: Campaign[] = []) =>
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/audiences/preview")) {
        const { filters } = JSON.parse(String(init!.body));
        return filters.role === "nobody" ? { ...preview({ total: 0, verifiedEmployment: 0, discoveryOnly: 0, fresh: 0, stale: 0, verifiedEmail: 0 }), sample: [] } : preview(filters.role ? { total: 3 } : {});
      }
      if (url.endsWith("/audiences")) return { audience: { id: "aud-1", name: "x", filters: {}, listId: "list-1", stats: {}, updatedAt: "" } };
      if (url.endsWith("/campaigns/review-queue")) return { items: queue, total: queue.length };
      if (url.endsWith("/dismiss")) return detail({ campaign: campaign({ status: "dismissed" }) });
      if (url.endsWith("/campaigns") && init?.method === "POST") return { campaign: campaign() };
      return { campaigns, total: campaigns.length };
    });

  it("shows live counts and freshness for the audience and updates them as filters change", async () => {
    home();
    renderWithClient(<CampaignsHome />);
    await waitFor(() => expect(count("people")).toBe("12"));
    expect(count("verified")).toBe("7");
    expect(count("discovery")).toBe("5");
    expect(count("fresh")).toBe("10");
    expect(count("stale")).toBe("2");
    expect(count("verified-email")).toBe("4");
    expect(within(screen.getByTestId("count-fresh")).getByText("within 90 days")).toBeTruthy();
    expect(screen.getByText("1 suppressed")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Priya Raman" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("e.g. revenue operations"), { target: { value: " revenue " } });
    await waitFor(() => expect(count("people")).toBe("3"));
    expect(calls((url) => url.endsWith("/audiences/preview")).at(-1)).toEqual({ filters: { role: "revenue" } });
  });

  it("saves the audience and drafts a campaign, without enrolling anyone", async () => {
    home();
    renderWithClient(<CampaignsHome />);
    await waitFor(() => expect(count("people")).toBe("12"));
    const button = screen.getByRole("button", { name: "Save audience and draft campaign" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("e.g. Revenue leaders, Berlin"), { target: { value: "Revenue leaders" } });
    fireEvent.click(button);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/enrichment/campaigns/11111111-1111-4111-8111-111111111111"));
    expect(calls((url) => url.endsWith("/audiences"))).toEqual([{ name: "Revenue leaders", filters: {} }]);
    expect(calls((url) => url.endsWith("/campaigns"))).toEqual([{ name: "Revenue leaders", audienceId: "aud-1" }]);
    expect(mockApiFetch.mock.calls.some(([url]) => /launch|enroll/.test(String(url)))).toBe(false);
    expect(screen.getByText(/Nobody is enrolled or emailed until a reviewer approves it/)).toBeTruthy();
  });

  it("will not build a campaign from an empty audience, or without permission", async () => {
    home();
    const first = renderWithClient(<CampaignsHome />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. revenue operations"), { target: { value: "nobody" } });
    await waitFor(() => expect(count("people")).toBe("0"));
    fireEvent.change(screen.getByPlaceholderText("e.g. Revenue leaders, Berlin"), { target: { value: "Empty" } });
    expect((screen.getByRole("button", { name: "Save audience and draft campaign" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Nobody matches these filters.")).toBeTruthy();
    first.unmount();

    mockHasPermission.mockReturnValue(false);
    renderWithClient(<CampaignsHome />);
    expect(await screen.findByText(/You need the “run enrichment” permission to build a campaign/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save audience and draft campaign" })).toBeNull();
  });

  it("lists job-change suggestions as review items that have not been sent", async () => {
    const jobChange = claim({ kind: "job_change", text: "I saw that you recently moved into the VP Sales role at Initech." });
    home([{ campaign: campaign({ id: "22222222-2222-4222-8222-222222222222", name: "Job change: Tess", trigger: "job_change" }), recipient: recipient({ fullName: "Tess Lane" }), claimsInCopy: [jobChange] }]);
    renderWithClient(<CampaignsHome />);
    const item = await screen.findByTestId("review-item");
    expect(within(item).getByText("Tess Lane")).toBeTruthy();
    expect(within(item).getByText("Not sent")).toBeTruthy();
    expect(within(item).getByText(jobChange.text)).toBeTruthy();
    expect(within(item).getByTestId("claim").textContent).toMatch(/Verified.*LinkedIn profile · captured .*2026.* · 90% confidence/);
    expect(within(item).getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/enrichment/campaigns/22222222-2222-4222-8222-222222222222");
    // The queue offers review and dismiss. There is no send here.
    expect(within(item).queryByRole("button", { name: /send|launch|approve/i })).toBeNull();
    fireEvent.click(within(item).getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(expect.stringMatching(/2222.*\/dismiss$/), expect.objectContaining({ method: "POST" })));
  });

  it("lists campaigns with their status and says so when the queue is empty", async () => {
    home([], [campaign({ status: "pending_review" }), campaign({ id: "33333333-3333-4333-8333-333333333333", name: "Job change: X", trigger: "job_change" })]);
    renderWithClient(<CampaignsHome />);
    const list = await screen.findByTestId("campaign-list");
    expect(await within(list).findByText("Awaiting review")).toBeTruthy();
    expect(within(list).queryByText("Job change: X")).toBeNull();
    expect(screen.getByText("No job changes are waiting for review.")).toBeTruthy();
  });
});

describe("CampaignDetailView", () => {
  const serve = (state: { current: CampaignDetail }) =>
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.endsWith("/submit")) state.current = detail({ campaign: campaign({ status: "pending_review" }) });
      else if (url.endsWith("/review")) {
        state.current =
          body.decision === "approved"
            ? detail({ campaign: campaign({ status: "approved", approvedAt: "2026-10-12T10:00:00.000Z", approvedBy: "u1" }), sendEnabled: true, reviews: [{ id: "r1", decision: "approved", comment: body.comment ?? null, reviewerId: "u1", recipientCount: 2, createdAt: "2026-10-12T10:00:00.000Z" }] })
            : detail({ campaign: campaign({ status: "rejected", reviewComment: body.comment }) });
      } else if (url.endsWith("/launch")) {
        state.current = detail({ campaign: campaign({ status: "launched", sequenceId: "seq-1", approvedAt: "2026-10-12T10:00:00.000Z" }), outcomes: { enrolled: 2, sent: 0, replied: 0, bounced: 0, unsubscribed: 0 } });
        return { ...state.current, enrolled: 2, skipped: [] };
      } else if (url.endsWith("/draft")) return { draft: state.current.draft, problems: [] };
      else if (url.includes("/recipients/")) return { recipient: recipient() };
      return state.current;
    });
  const view = () => renderWithClient(<CampaignDetailView campaignId="11111111-1111-4111-8111-111111111111" />);
  const row = (name: string) => screen.getByRole("link", { name }).closest("tr")!;

  it("shows each talking point with its source, capture time, confidence and a verified or discovery marker", async () => {
    serve({ current: detail() });
    view();
    await screen.findByRole("heading", { name: "Revenue leaders" });

    const priya = within(row("Priya Raman")).getAllByTestId("claim");
    expect(priya).toHaveLength(2);
    expect(priya[0]!.textContent).toMatch(/I saw that you're Head of Revenue at Initech\..*Verified.*LinkedIn profile · captured .*2026.* · 90% confidence/);
    expect(priya[1]!.textContent).toMatch(/Initech is listed under Software Development\..*Verified.*LinkedIn company page · captured .*2026.* · 85% confidence/);
    expect(priya.every((item) => item.getAttribute("data-usable") === "true")).toBe(true);
    expect(within(priya[0]!).getByRole("link").getAttribute("href")).toBe("https://www.linkedin.com/in/priya-raman/");

    const lead = row("Lead Card");
    expect(within(lead).getByText(/No supported talking point/)).toBeTruthy();
    const flagged = within(lead).getByTestId("claim");
    expect(flagged.getAttribute("data-state")).toBe("discovery");
    expect(flagged.getAttribute("data-usable")).toBe("false");
    expect(flagged.textContent).toMatch(/Discovery.*Sales Navigator search card .* 50% confidence/);
    expect(flagged.textContent).toMatch(/Not used in copy: Seen on a search card only/);

    // Every claim on the page carries an evidence reference line.
    for (const item of screen.getAllByTestId("claim")) expect(item.textContent).toMatch(/captured .* · \d+% confidence/);
  });

  it("shows suppression, consent and verification per recipient, and why someone is excluded", async () => {
    serve({ current: detail() });
    view();
    await screen.findByRole("heading", { name: "Revenue leaders" });

    const priya = row("Priya Raman");
    expect(priya.getAttribute("data-eligibility")).toBe("eligible");
    for (const label of ["Verified valid", "No consent record", "Not suppressed", "Included"]) expect(within(priya).getByText(label)).toBeTruthy();

    const sam = row("Sam Suppressed");
    expect(sam.getAttribute("data-eligibility")).toBe("excluded");
    for (const label of ["Suppressed", "Consent on record", "Excluded"]) expect(within(sam).getByText(label)).toBeTruthy();
    expect(within(sam).getByText(/on the workspace suppression list/)).toBeTruthy();
    // An excluded person cannot be included from the UI.
    expect(within(sam).queryByRole("button", { name: /Include|Remove/ })).toBeNull();

    const uma = row("Uma Unverified");
    expect(within(uma).getByText("Not verified")).toBeTruthy();
    expect(within(uma).getByText("The email has not been verified as valid")).toBeTruthy();
    expect(screen.getByText(/2 of 4 will be enrolled · 2 excluded · 1 without a supported talking point/)).toBeTruthy();

    fireEvent.change(within(priya).getByLabelText("Reason for removing Priya Raman"), { target: { value: "Existing customer" } });
    fireEvent.click(within(priya).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(calls((url) => url.includes("/recipients/p1"), "PUT")).toEqual([{ decision: "removed", comment: "Existing customer" }]));
  });

  it("keeps send disabled until an approval is recorded, then launches", async () => {
    serve({ current: detail() });
    view();
    const launch = (await screen.findByRole("button", { name: "Launch sequence" })) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
    expect(screen.getByTestId("send-state").textContent).toMatch(/No approval is recorded yet/);
    expect(screen.queryByRole("button", { name: "Approve recipients and copy" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    const approve = await screen.findByRole("button", { name: "Approve recipients and copy" });
    expect((screen.getByRole("button", { name: "Launch sequence" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("send-state").textContent).toMatch(/Waiting for a reviewer/);
    // Rejecting needs a comment.
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Review comment"), { target: { value: "Looks right." } });
    fireEvent.change(screen.getByPlaceholderText("e.g. legitimate_interest"), { target: { value: "legitimate_interest" } });
    fireEvent.click(approve);
    await waitFor(() => expect((screen.getByRole("button", { name: "Launch sequence" }) as HTMLButtonElement).disabled).toBe(false));
    expect(calls((url) => url.endsWith("/review"))).toEqual([{ decision: "approved", comment: "Looks right.", consentBasis: "legitimate_interest" }]);
    expect(screen.getByTestId("send-state").textContent).toMatch(/Launching enrolls the 2 included recipients/);
    expect(screen.getByText("“Looks right.”")).toBeTruthy();
    expect(calls((url) => url.endsWith("/launch"))).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Launch sequence" }));
    expect(await screen.findByText(/Launched\. 2 recipients enrolled\./)).toBeTruthy();
    expect(screen.getByTestId("campaign-status").getAttribute("data-status")).toBe("launched");
    expect(within(screen.getByTestId("outcomes")).getByText("2")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Launch sequence" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("rejects with a comment and shows it to the author", async () => {
    serve({ current: detail({ campaign: campaign({ status: "pending_review" }) }) });
    view();
    fireEvent.change(await screen.findByLabelText("Review comment"), { target: { value: "Tone is too pushy." } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Rejected by the reviewer")).toBeTruthy();
    expect(screen.getByText("Tone is too pushy.")).toBeTruthy();
    expect(calls((url) => url.endsWith("/review"))).toEqual([{ decision: "rejected", comment: "Tone is too pushy." }]);
    expect((screen.getByRole("button", { name: "Launch sequence" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires a lawful basis when consent is enforced, and hides approval from people who cannot send", async () => {
    serve({ current: detail({ campaign: campaign({ status: "pending_review" }), consentEnforced: true }) });
    const first = view();
    const approve = (await screen.findByRole("button", { name: "Approve recipients and copy" })) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(screen.getByText(/Lawful basis for the 2 recipients with no consent record \(required\)/)).toBeTruthy();
    first.unmount();

    mockHasPermission.mockImplementation((permission) => permission !== "sequences:send");
    view();
    expect(await screen.findByText(/Waiting for someone with the send permission/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve recipients and copy" })).toBeNull();
    expect((screen.getByRole("button", { name: "Launch sequence" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says when an approval was withdrawn, blocks submission on unfinished copy, and explains sandbox sending", async () => {
    serve({
      current: detail({
        campaign: campaign({ status: "changes_required", reviewComment: "Evidence or contact details changed after approval." }),
        problems: ["Step 1 still contains placeholder text in [brackets]."],
        reviews: [{ id: "r2", decision: "invalidated", comment: "Evidence or contact details changed after approval.", reviewerId: null, recipientCount: 0, createdAt: "2026-10-12T11:00:00.000Z" }],
      }),
    });
    view();
    expect(await screen.findByText("Needs review again")).toBeTruthy();
    expect(screen.getByText("Approval withdrawn")).toBeTruthy();
    expect(screen.getByText("Step 1 still contains placeholder text in [brackets].")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Submit for review" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("send-state").textContent).toMatch(/Something changed after approval/);
    expect(screen.getByText(/This is not production\. Campaign emails go only to: @sandbox\.example/)).toBeTruthy();
  });

  it("saves edited copy", async () => {
    serve({ current: detail() });
    view();
    const save = (await screen.findByRole("button", { name: "Save copy" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Step 2 subject"), { target: { value: "Re: one more thing" } });
    fireEvent.click(save);
    await waitFor(() => expect(calls((url) => url.endsWith("/draft"), "PUT")).toHaveLength(1));
    expect(calls((url) => url.endsWith("/draft"), "PUT")[0].steps[1]).toMatchObject({ order: 2, subject: "Re: one more thing" });
  });
});

describe("sendBlockedReason", () => {
  it("is null only when an approval is on record", () => {
    expect(sendBlockedReason({ campaign: campaign({ status: "approved" }), sendEnabled: true })).toBeNull();
    for (const status of ["draft", "pending_review", "rejected", "changes_required", "launched", "dismissed"] as const) {
      expect(sendBlockedReason({ campaign: campaign({ status }), sendEnabled: false }), status).toBeTruthy();
    }
  });
});
