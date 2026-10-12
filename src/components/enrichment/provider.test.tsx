import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jobAction, jobStatus, type ContactData, type ContactValue, type ProviderConnection, type ProviderJob, type ProvidersResponse } from "@/lib/enrichment-provider";
import { AddLinkedinProfile } from "./add-linkedin-profile";
import { ContactDataPanel } from "./contact-data-panel";
import { ProviderConnections } from "./provider-connections";
import { JobStatusLine, ReEnrichControl } from "./provider-jobs";

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

const job = (overrides: Partial<ProviderJob> = {}): ProviderJob => ({
  id: "11111111-1111-4111-8111-111111111111",
  correlationId: "22222222-2222-4222-8222-222222222222",
  status: "queued",
  terminal: false,
  targetType: "person",
  targetId: "p1",
  sourceUrl: "https://www.linkedin.com/in/priya-raman/",
  normalizedUrl: "https://www.linkedin.com/in/priya-raman/",
  provider: "unipile",
  trigger: "manual",
  attemptCount: 0,
  maxAttempts: 3,
  nextAttemptAt: null,
  errorCode: null,
  errorMessage: null,
  result: null,
  testMode: false,
  queuedAt: "2026-10-12T09:00:00.000Z",
  startedAt: null,
  completedAt: null,
  updatedAt: "2026-10-12T09:00:00.000Z",
  ...overrides,
});
const actionRequired = job({
  status: "action_required",
  terminal: true,
  attemptCount: 1,
  errorCode: "PROVIDER_CONNECTION_REQUIRED",
  errorMessage: "Connect an authorised LinkedIn provider account before background enrichment can run.",
  completedAt: "2026-10-12T09:00:05.000Z",
});

const connection = (overrides: Partial<ProviderConnection> = {}): ProviderConnection => ({
  id: "33333333-3333-4333-8333-333333333333",
  provider: "unipile",
  externalAccountId: "unipile-account-1",
  status: "active",
  credentialSource: "workspace",
  lastCheckedAt: "2026-10-12T08:00:00.000Z",
  lastErrorCode: null,
  createdAt: "2026-10-10T08:00:00.000Z",
  updatedAt: "2026-10-12T08:00:00.000Z",
  ...overrides,
});
const providers = (overrides: Partial<ProvidersResponse> = {}): ProvidersResponse => ({
  testMode: false,
  providers: [
    { id: "unipile", name: "Unipile", purpose: "Retrieve a LinkedIn profile.", legalStatus: "approved", permitted: true, reason: null, rawResponseRetentionDays: 90 },
  ],
  connections: [connection()],
  ...overrides,
});

const value = (overrides: Partial<ContactValue> = {}): ContactValue => ({
  value: "priya@initech.example",
  provenance: { kind: "provider", provider: "hunter", jobId: "j1", correlationId: "c1", confidence: 0.93, observedAt: "2026-10-12T09:00:00.000Z" },
  verification: { status: "valid", provider: "zerobounce", verifiedAt: "2026-10-12T09:00:01.000Z", deliverabilityScore: 96 },
  freshness: { observedAt: "2026-10-12T09:00:00.000Z", ageDays: 0, stale: false },
  ...overrides,
});
const contactData = (overrides: Partial<ContactData> = {}): ContactData => ({
  prospectId: "p1",
  contactId: "c1",
  email: null,
  phone: null,
  otherPhones: [],
  lastRun: null,
  freshnessDays: 90,
  ...overrides,
});

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const bodyOf = (match: (url: string) => boolean) => {
  const call = mockApiFetch.mock.calls.find(([url, init]) => match(String(url)) && init?.method === "POST");
  return call ? JSON.parse(String(call[1].body)) : undefined;
};

beforeEach(() => mockHasPermission.mockReturnValue(true));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("job status", () => {
  it("labels every state and never shows an unknown state as success", () => {
    expect(jobStatus("queued").label).toBe("Queued");
    expect(jobStatus("running").label).toBe("Running");
    expect(jobStatus("partial").label).toBe("Partial");
    expect(jobStatus("action_required").label).toBe("Action required");
    expect(jobStatus("failed")).toEqual({ label: "Failed", tone: "danger" });
    expect(jobStatus("done")).toEqual({ label: "Done", tone: "success" });
    expect(jobStatus("something_new").tone).toBe("muted");
  });

  it("turns an actionable error code into a link to the fix", () => {
    expect(jobAction({ errorCode: "PROVIDER_CONNECTION_REQUIRED" })).toEqual({ label: "Connect a provider", href: "/enrichment/providers" });
    expect(jobAction({ errorCode: "PROVIDER_CREDENTIAL_REJECTED" })?.href).toBe("/settings/integrations");
    expect(jobAction({ errorCode: "PROFILE_NOT_FOUND" })).toBeNull();
    expect(jobAction({ errorCode: null })).toBeNull();
  });

  it("shows ACTION_REQUIRED with its reason and the connect link", () => {
    render(<JobStatusLine job={actionRequired} />);
    expect(screen.getByTestId("job-status").getAttribute("data-status")).toBe("action_required");
    expect(screen.getByText(/Connect an authorised LinkedIn provider account/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Connect a provider" }).getAttribute("href")).toBe("/enrichment/providers");
    expect(screen.getByText(/attempt 1 of 3/)).toBeTruthy();
  });

  it("does not word a queued or retrying job as finished", () => {
    render(<JobStatusLine job={job({ attemptCount: 1, errorCode: "RETRY_SCHEDULED", errorMessage: "The provider returned 503. Attempt 1 of 3; trying again automatically.", nextAttemptAt: "2026-10-12T09:01:00.000Z" })} />);
    const line = screen.getByTestId("job-status-line");
    expect(line.textContent).toMatch(/Queued/);
    expect(line.textContent).toMatch(/Next attempt/);
    expect(line.textContent).not.toMatch(/Finished/);
  });

  it("lists what a partial job saw but did not add, and marks test mode", () => {
    render(
      <JobStatusLine
        job={job({
          status: "partial",
          terminal: true,
          testMode: true,
          completedAt: "2026-10-12T09:00:05.000Z",
          result: { message: "The provider response was stored as evidence.", evidenceOnly: [{ attribute: "headline", mappingStatus: "unverified", contactData: false }, { attribute: "emails", mappingStatus: "unverified", contactData: true }] },
        })}
      />
    );
    expect(screen.getByText("Partial")).toBeTruthy();
    expect(screen.getByText("Test mode")).toBeTruthy();
    expect(screen.getByText(/Seen but not added: headline, emails\./)).toBeTruthy();
  });
});

describe("AddLinkedinProfile", () => {
  it("creates a job for a LinkedIn URL and shows its status until it is terminal", async () => {
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/provider-jobs") && init?.method === "POST") return { job: job(), reused: false, testMode: false };
      if (url.includes("/provider-jobs/")) return { job: actionRequired, attempts: [] };
      if (url.includes("/provider-jobs?")) return { data: [], total: 0 };
      return providers();
    });
    renderWithClient(<AddLinkedinProfile />);
    const submit = await screen.findByRole("button", { name: "Add and enrich" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("LinkedIn URL"), { target: { value: "https://www.linkedin.com/sales/lead/ACwAAA,NAME" } });
    expect(screen.getByText(/Sales Navigator links are not accepted/)).toBeTruthy();
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("LinkedIn URL"), { target: { value: " https://www.linkedin.com/in/priya-raman/ " } });
    fireEvent.click(submit);
    const current = await screen.findByTestId("current-job");
    expect(bodyOf((url) => url.endsWith("/provider-jobs"))).toEqual({ url: "https://www.linkedin.com/in/priya-raman/" });
    expect(await within(current).findByText("Action required")).toBeTruthy();
    expect(within(current).getByRole("link", { name: "Connect a provider" })).toBeTruthy();
    expect(within(current).getByRole("link", { name: "Open the record" }).getAttribute("href")).toBe("/enrichment/people/p1");
  });

  it("warns before a run when no provider is connected, and says when test mode is on", async () => {
    mockApiFetch.mockImplementation(async (url: string) => (url.includes("/provider-jobs") ? { data: [], total: 0 } : providers({ connections: [connection({ status: "revoked" })] })));
    const first = renderWithClient(<AddLinkedinProfile />);
    expect(await screen.findByText("No provider connected")).toBeTruthy();
    first.unmount();

    mockApiFetch.mockImplementation(async (url: string) => (url.includes("/provider-jobs") ? { data: [], total: 0 } : providers({ testMode: true, connections: [] })));
    renderWithClient(<AddLinkedinProfile />);
    expect(await screen.findByText(/Only the URL you submit is recorded/)).toBeTruthy();
    expect(screen.queryByText("No provider connected")).toBeNull();
  });

  it("says a URL already has a run instead of starting a second one, and hides the form without permission", async () => {
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/provider-jobs") && init?.method === "POST") return { job: job({ status: "running", attemptCount: 1 }), reused: true, testMode: false };
      if (url.includes("/provider-jobs/")) return { job: job({ status: "running", attemptCount: 1 }), attempts: [] };
      if (url.includes("/provider-jobs?")) return { data: [], total: 0 };
      return providers();
    });
    const first = renderWithClient(<AddLinkedinProfile />);
    fireEvent.change(await screen.findByLabelText("LinkedIn URL"), { target: { value: "https://www.linkedin.com/company/initech/" } });
    fireEvent.click(screen.getByRole("button", { name: "Add and enrich" }));
    expect(await screen.findByText("This URL already has a run in progress")).toBeTruthy();
    first.unmount();

    mockHasPermission.mockReturnValue(false);
    renderWithClient(<AddLinkedinProfile />);
    expect(await screen.findByText(/You need the “run enrichment” permission/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add and enrich" })).toBeNull();
  });
});

describe("ReEnrichControl", () => {
  const control = (props: Partial<Parameters<typeof ReEnrichControl>[0]> = {}) => (
    <ReEnrichControl targetId="p1" url="https://www.linkedin.com/in/priya-raman/" canEnrich missingUrlReason="Needs a public LinkedIn profile URL." {...props} />
  );

  it("shows the last run and starts a new one", async () => {
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return { job: job(), reused: false, testMode: false };
      return { data: [job({ status: "failed", terminal: true, attemptCount: 3, errorCode: "PROVIDER_REQUEST_FAILED", errorMessage: "The provider returned 503. The job stopped after 3 attempts.", completedAt: "2026-10-11T09:00:00.000Z" })], total: 1 };
    });
    renderWithClient(control());
    expect(await screen.findByText("Last run")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText(/stopped after 3 attempts/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Re-enrich/ }));
    await waitFor(() => expect(bodyOf((url) => url.endsWith("/provider-jobs"))).toEqual({ url: "https://www.linkedin.com/in/priya-raman/" }));
  });

  it("is disabled while a run is unfinished or when there is no URL", async () => {
    mockApiFetch.mockResolvedValue({ data: [job({ status: "running", attemptCount: 1 })], total: 1 });
    const running = renderWithClient(control());
    expect(await screen.findByText("Running")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Re-enrich/ }) as HTMLButtonElement).disabled).toBe(true);
    running.unmount();

    mockApiFetch.mockResolvedValue({ data: [], total: 0 });
    renderWithClient(control({ url: null }));
    expect(await screen.findByText("No provider run yet.")).toBeTruthy();
    expect(screen.getByText("Needs a public LinkedIn profile URL.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Re-enrich/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ProviderConnections", () => {
  it("shows status and never a secret, and lets an admin check and disconnect", async () => {
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return { connection: connection({ status: "revoked" }) };
      if (url.endsWith("/check")) return { connection: connection() };
      return providers({ connections: [connection({ lastErrorCode: "provider_credential_rejected" })] });
    });
    const { container } = renderWithClient(<ProviderConnections />);
    const row = await screen.findByTestId("provider-connection");
    expect(within(row).getByText("Connected")).toBeTruthy();
    expect(within(row).getByText("Needs attention")).toBeTruthy();
    expect(within(row).getByText(/rejected the stored key/)).toBeTruthy();
    expect(within(row).getByText(/workspace's own key/)).toBeTruthy();
    // The only input is the account id; there is nowhere to type or read a key.
    expect(container.querySelectorAll("input").length).toBe(1);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.textContent).not.toMatch(/api[_ ]?key\s*[:=]/i);

    fireEvent.click(within(row).getByRole("button", { name: "Check" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(expect.stringMatching(/\/provider-connections\/3333.*\/check$/), expect.objectContaining({ method: "POST" })));

    fireEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
    expect(mockApiFetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(expect.stringMatching(/\/provider-connections\/3333/), expect.objectContaining({ method: "DELETE" })));
  });

  it("connects an account by id only", async () => {
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => (init?.method === "POST" ? { connection: connection() } : providers({ connections: [] })));
    renderWithClient(<ProviderConnections />);
    expect(await screen.findByText(/No provider account is connected/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Connect a Unipile LinkedIn account"), { target: { value: " unipile-account-1 " } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(bodyOf((url) => url.endsWith("/provider-connections/unipile"))).toEqual({ externalAccountId: "unipile-account-1" }));
  });

  it("explains why a provider cannot be connected, and is read-only for non-admins", async () => {
    const pending = providers({
      connections: [connection()],
      providers: [{ id: "unipile", name: "Unipile", purpose: "Retrieve a LinkedIn profile.", legalStatus: "pending_legal_review", permitted: false, reason: "Unipile is awaiting legal approval and cannot be used for enrichment yet.", rawResponseRetentionDays: 90 }],
    });
    mockApiFetch.mockResolvedValue(pending);
    const admin = renderWithClient(<ProviderConnections />);
    expect(await screen.findByText("Awaiting legal approval")).toBeTruthy();
    expect(screen.getAllByText(/awaiting legal approval and cannot be used/).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Connect a Unipile LinkedIn account") as HTMLInputElement).disabled).toBe(true);
    admin.unmount();

    mockHasPermission.mockReturnValue(false);
    renderWithClient(<ProviderConnections />);
    expect(await screen.findByText(/Only workspace admins can connect or disconnect/)).toBeTruthy();
    for (const name of ["Check", "Disconnect", "Connect"]) expect(screen.queryByRole("button", { name })).toBeNull();
  });
});

describe("ContactDataPanel", () => {
  const panel = (props: Partial<Parameters<typeof ContactDataPanel>[0]> = {}) => (
    <ContactDataPanel prospectId="p1" canEnrich onFindContactData={() => undefined} findPending={false} {...props} />
  );

  it("shows provider, provenance, verification status and freshness for each value", async () => {
    mockApiFetch.mockResolvedValue({
      contactData: contactData({
        email: value(),
        phone: value({
          value: "+15550100",
          provenance: { kind: "provider", provider: "datagma", jobId: "j1", correlationId: "c1", confidence: null, observedAt: "2026-06-01T09:00:00.000Z" },
          verification: { status: "unverified", provider: null, verifiedAt: null, deliverabilityScore: null },
          freshness: { observedAt: "2026-06-01T09:00:00.000Z", ageDays: 133, stale: true },
        }),
        otherPhones: [{ type: "direct", value: "+15550101" }],
        lastRun: { jobId: "j1", status: "done", completedAt: "2026-10-12T09:00:02.000Z", queuedAt: "2026-10-12T09:00:00.000Z" },
      }),
    });
    renderWithClient(panel());
    const email = await screen.findByTestId("contact-email");
    expect(within(email).getByText("priya@initech.example")).toBeTruthy();
    expect(within(email).getByText("Verified valid")).toBeTruthy();
    expect(email.textContent).toMatch(/Supplied by hunter · 93% provider confidence/);
    expect(email.textContent).toMatch(/Checked by zerobounce .* deliverability 96\/100/);
    expect(email.textContent).toMatch(/today/);

    const phone = screen.getByTestId("contact-phone");
    expect(within(phone).getByText("Not verified")).toBeTruthy();
    expect(within(phone).getByText("Stale")).toBeTruthy();
    expect(phone.textContent).toMatch(/Supplied by datagma/);
    expect(phone.textContent).toMatch(/133 days ago/);
    expect(phone.textContent).toMatch(/Nobody has verified this value/);
    expect(screen.getByText(/Also returned: direct \+15550101/)).toBeTruthy();
    expect(screen.getByText(/Last contact lookup: done/)).toBeTruthy();
  });

  it("leaves absent data absent", async () => {
    mockApiFetch.mockResolvedValue({ contactData: contactData() });
    renderWithClient(panel());
    const email = await screen.findByTestId("contact-email");
    expect(email.getAttribute("data-state")).toBe("absent");
    expect(email.textContent).toMatch(/No email on record/);
    expect(screen.getByTestId("contact-phone").textContent).toMatch(/No phone number on record/);
    expect(screen.getByTestId("contact-data").textContent).not.toMatch(/@/);
    expect((screen.getByRole("button", { name: /Verify email/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Skout does not guess contact details/)).toBeTruthy();
  });

  it("labels a pattern-built address and a manual one for what they are", async () => {
    mockApiFetch.mockResolvedValue({
      contactData: contactData({
        email: value({ provenance: { kind: "pattern_verified", provider: "pattern-gen", jobId: "j1", correlationId: "c1", confidence: 0.4, observedAt: "2026-10-12T09:00:00.000Z" } }),
        phone: value({ value: "+15550123", provenance: { kind: "manual", provider: "manual", jobId: null, correlationId: null, confidence: null, observedAt: null }, verification: { status: "unverified", provider: null, verifiedAt: null, deliverabilityScore: null } }),
      }),
    });
    renderWithClient(panel());
    expect((await screen.findByTestId("contact-email")).textContent).toMatch(/Built from a name pattern, then confirmed by verification/);
    expect(screen.getByTestId("contact-phone").textContent).toMatch(/Entered by a teammate/);
  });

  it("verifies the email and shows the new status; actions are hidden without permission", async () => {
    const unverified = value({ verification: { status: "unverified", provider: null, verifiedAt: null, deliverabilityScore: null } });
    mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? { contactData: contactData({ email: value({ verification: { status: "catch_all", provider: "email-intel", verifiedAt: "2026-10-12T10:00:00.000Z", deliverabilityScore: 55 } }) }) }
        : { contactData: contactData({ email: unverified }) }
    );
    const onFind = vi.fn();
    const first = renderWithClient(panel({ onFindContactData: onFind }));
    expect(await screen.findByText("Not verified")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Find contact data/ }));
    expect(onFind).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Verify email/ }));
    expect(await screen.findByText("Catch-all domain")).toBeTruthy();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/people/p1/contact-data/verify-email", expect.objectContaining({ method: "POST" }));
    first.unmount();

    renderWithClient(panel({ canEnrich: false }));
    await screen.findByTestId("contact-email");
    for (const name of [/Find contact data/, /Verify email/]) expect(screen.queryByRole("button", { name })).toBeNull();
  });
});
