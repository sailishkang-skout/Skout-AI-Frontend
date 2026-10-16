import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrmHealthDashboard } from "./crm-health-dashboard";
import { CrmConflictQueue } from "./crm-conflict-queue";
import { CrmDlqHistory } from "./crm-dlq-history";
import { CrmMappingEditor } from "./crm-mapping-editor";
import { CrmSyncSettings } from "./crm-sync-settings";
import { ApiError } from "@/lib/api-client";

const mockGetConnectorHealth = vi.fn();
const mockListConflicts = vi.fn();
const mockResolveConflict = vi.fn();
const mockListOutboundWrites = vi.fn();
const mockReplayOutboundWrite = vi.fn();
const mockGetMappings = vi.fn();
const mockSaveMappings = vi.fn();
const mockTriggerPoll = vi.fn();
const mockRunInitialImport = vi.fn();
const mockGetOptIn = vi.fn();
const mockUpdateOptIn = vi.fn();

vi.mock("@/lib/crm", () => ({
  useCrmApi: () => ({
    getConnectorHealth: mockGetConnectorHealth,
    listConflicts: mockListConflicts,
    resolveConflict: mockResolveConflict,
    listOutboundWrites: mockListOutboundWrites,
    replayOutboundWrite: mockReplayOutboundWrite,
    getMappings: mockGetMappings,
    saveMappings: mockSaveMappings,
    triggerPoll: mockTriggerPoll,
    runInitialImport: mockRunInitialImport,
    getOptIn: mockGetOptIn,
    updateOptIn: mockUpdateOptIn,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CRM Sync Frontend Components (COPS-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("CrmHealthDashboard", () => {
    it("renders healthy auth status, backlog, and checkpoint indicators", async () => {
      mockGetConnectorHealth.mockResolvedValue({
        data: {
          connected: true,
          provider: "hubspot",
          authStatus: "connected",
          lastSyncAt: "2026-10-15T12:00:00.000Z",
          backlog: 4,
          failedRecords: 2,
          pendingConflicts: 1,
          rateLimitState: null,
          checkpoints: [
            {
              entityType: "contact",
              lastRunStatus: "succeeded",
              lastRunCompletedAt: "2026-10-15T12:00:00.000Z",
              lastError: null,
              cursor: null,
            },
          ],
        },
      });

      renderWithClient(<CrmHealthDashboard provider="hubspot" />);

      await screen.findByText("Connector Observability & Health");
      await screen.findByText("Healthy & Connected");
      await screen.findByText("4 queued");
      expect(screen.getByText("2")).toBeDefined();
      expect(screen.getByText("1")).toBeDefined();
    });

    it("displays rate limit banner when rate limit is active", async () => {
      mockGetConnectorHealth.mockResolvedValue({
        data: {
          connected: true,
          provider: "hubspot",
          authStatus: "connected",
          lastSyncAt: null,
          backlog: 0,
          failedRecords: 0,
          pendingConflicts: 0,
          rateLimitState: {
            isRateLimited: true,
            lastRateLimitedAt: "2026-10-15T12:00:00.000Z",
            limitedUntil: "2026-10-15T12:05:00.000Z",
          },
          checkpoints: [],
        },
      });

      renderWithClient(<CrmHealthDashboard provider="hubspot" />);

      await screen.findByText(/Rate limit active:/);
    });
  });

  describe("CrmConflictQueue", () => {
    it("displays side-by-side values and allows resolution", async () => {
      mockListConflicts.mockResolvedValue({
        data: [
          {
            id: "conf-1",
            workspaceId: "ws-1",
            connectionId: "conn-1",
            entityType: "contact",
            entityId: "cont-1",
            externalId: "ext-1",
            fieldName: "title",
            skoutValue: "VP Engineering",
            externalValue: "CTO",
            policy: "manual_review",
            status: "pending",
            createdAt: "2026-10-15T10:00:00.000Z",
          },
        ],
        limit: 50,
        offset: 0,
      });

      mockResolveConflict.mockResolvedValue({ ok: true });

      renderWithClient(<CrmConflictQueue />);

      await screen.findByText("Conflict Resolution Queue");
      await screen.findByText("VP Engineering");
      await screen.findByText("CTO");

      const keepSkoutBtn = screen.getByRole("button", { name: "Keep Skout" });
      fireEvent.click(keepSkoutBtn);

      await waitFor(() => {
        expect(mockResolveConflict).toHaveBeenCalledWith("conf-1", { choice: "skout" });
      });
    });
  });

  describe("CrmDlqHistory", () => {
    it("lists failed records in the DLQ and triggers replay", async () => {
      mockListOutboundWrites.mockResolvedValue({
        data: [
          {
            id: "write-1",
            workspaceId: "ws-1",
            connectionId: "conn-1",
            entityType: "contact",
            entityId: "c-1",
            patch: { email: "test@example.com" },
            status: "failed",
            attemptCount: 3,
            lastError: "HubSpot 429 Too Many Requests",
            createdAt: "2026-10-15T11:00:00.000Z",
          },
        ],
        limit: 50,
        offset: 0,
      });

      mockReplayOutboundWrite.mockResolvedValue({ ok: true });

      renderWithClient(<CrmDlqHistory />);

      await screen.findByText("Sync History & Dead Letter Queue (DLQ)");
      await screen.findByText(/HubSpot 429 Too Many Requests/);

      const replayBtn = screen.getByRole("button", { name: /Replay/i });
      fireEvent.click(replayBtn);

      await waitFor(() => {
        expect(mockReplayOutboundWrite).toHaveBeenCalledWith("write-1");
      });
    });
  });

  describe("CrmMappingEditor", () => {
    const contactMapping = {
      version: 3,
      entityType: "contact",
      externalObjectType: "contacts",
      fields: [
        {
          id: "contact_email",
          internalField: "email",
          externalField: "email",
          direction: "bidirectional",
          conflictPolicy: "skout_wins",
          transform: "lowercase",
          nullBehavior: "ignore",
        },
      ],
    };

    it("edits only the fields the sync owns and saves with the API's contract values", async () => {
      mockGetMappings.mockResolvedValue({
        data: {
          provider: "hubspot",
          mappings: { contact: contactMapping, deal: { version: 1, entityType: "deal", externalObjectType: "deals", fields: [] } },
        },
      });
      mockSaveMappings.mockResolvedValue({ ok: true, data: {} });

      renderWithClient(<CrmMappingEditor provider="hubspot" />);

      await screen.findByText("v3");
      fireEvent.click(screen.getByRole("button", { name: /Add field/i }));

      // The new row offers only unmapped syncable fields, never a free-text column name.
      const skoutFields = screen.getAllByLabelText("Skout field") as HTMLSelectElement[];
      expect(skoutFields).toHaveLength(2);
      expect(Array.from(skoutFields[1]!.options).map((o) => o.value)).toEqual(["firstName", "lastName", "phone", "title"]);

      fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
      await waitFor(() => expect(mockSaveMappings).toHaveBeenCalled());
      const saved = mockSaveMappings.mock.calls[0]![1].contact;
      expect(saved.fields[1]).toMatchObject({ internalField: "firstName", direction: "bidirectional", nullBehavior: "ignore", transform: "none" });
    });

    it("lists the API's reasons when a save is refused", async () => {
      mockGetMappings.mockResolvedValue({
        data: { provider: "hubspot", mappings: { contact: contactMapping, deal: contactMapping } },
      });
      mockSaveMappings.mockRejectedValue(
        new ApiError("Invalid mapping configuration", 422, { details: ["contact: hubspot has no property jobtitlee"] })
      );

      renderWithClient(<CrmMappingEditor provider="hubspot" />);
      await screen.findByText("v3");
      fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

      expect(await screen.findByText("contact: hubspot has no property jobtitlee")).toBeTruthy();
    });
  });

  describe("CrmSyncSettings", () => {
    it("shows sync as off by default and turns it on", async () => {
      const off = { syncEnabled: false, accountScope: ["*"], objectScope: { contacts: true, deals: true }, pollIntervalMinutes: 30 };
      mockGetOptIn.mockResolvedValue({ data: off });
      mockUpdateOptIn.mockResolvedValue({ ok: true, data: { ...off, syncEnabled: true } });

      renderWithClient(<CrmSyncSettings provider="hubspot" />);

      expect(await screen.findByText("Off")).toBeTruthy();
      await screen.findByLabelText("Poll interval"); // the settings have loaded
      fireEvent.click(screen.getByRole("button", { name: /Turn sync on/i }));

      await waitFor(() => expect(mockUpdateOptIn).toHaveBeenCalledWith("hubspot", { syncEnabled: true }));
      expect(await screen.findByText("On")).toBeTruthy();
    });
  });
});
