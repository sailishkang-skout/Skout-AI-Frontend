import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DexterChat } from "./dexter-chat";
import type { ToolActionPreview } from "@/lib/ai-chat";

// jsdom doesn't implement scrollTo; the component calls it (via a ref) on a delayed
// requestAnimationFrame after every send, well after a test's own assertions are done.
Element.prototype.scrollTo = () => {};

const mockChat = vi.fn();
const mockExecuteTool = vi.fn();

vi.mock("@/lib/ai-chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai-chat")>("@/lib/ai-chat");
  return {
    ...actual,
    useAiChatApi: () => ({
      chat: mockChat,
      executeTool: mockExecuteTool,
      enrollList: vi.fn(),
      downloadExport: vi.fn(),
      createFromSteps: vi.fn(),
      logAudit: vi.fn(),
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/dexter-speech", () => ({
  createSpeechRecognition: () => null,
  isSpeechRecognitionSupported: () => false,
  isSpeechSynthesisSupported: () => false,
  speakText: () => ({ cancel: () => {} }),
  stopSpeaking: () => {},
  warmSpeechVoices: () => {},
}));

vi.mock("@/components/vision/enterprise-control-strip", () => ({
  VisionEnterpriseControlStrip: () => null,
}));

vi.mock("@/components/vision/intelligence-strip", () => ({
  VisionIntelligenceStrip: () => null,
}));

function renderChat() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DexterChat />
    </QueryClientProvider>
  );
}

async function openPanelAndSend(text: string) {
  fireEvent.click(screen.getByTestId("dexter-fab"));
  const textarea = screen.getByRole("textbox");
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send to Dexter" }));
}

describe("DexterChat — §8.13 SP-13 tool response rendering", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders explain_score's scoreBreakdown as a structured card, not just the reply text", async () => {
    mockChat.mockResolvedValue({
      reply: "This prospect scores 72 on ICP fit.",
      action: { type: "none" },
      applied: false,
      scoreBreakdown: {
        prospectId: "p-1",
        icp: {
          score: 72,
          band: "medium",
          version: "3",
          source: "heuristic",
          dimensions: { industry: { score: 80, matched: true, explanation: "SaaS is in target industries" } },
          reasoning: "Strong industry fit.",
        },
        signalStack: {
          score: 41,
          band: "warm",
          distinctSignalTypes: 1,
          reachableDecisionMaker: false,
          contributingSignals: [],
          weights: {},
        },
      },
    });

    renderChat();
    await openPanelAndSend("why does this prospect score 72");

    await waitFor(() => screen.getByText("This prospect scores 72 on ICP fit."));
    expect(screen.getByText("ICP fit")).toBeTruthy();
    expect(screen.getByText("72/100")).toBeTruthy();
    expect(screen.getByText("Industry")).toBeTruthy();
  });

  it("does not render a score breakdown card when the turn has no scoreBreakdown", async () => {
    mockChat.mockResolvedValue({ reply: "Sure, done.", action: { type: "none" }, applied: false });

    renderChat();
    await openPanelAndSend("open my inbox");

    await waitFor(() => screen.getByText("Sure, done."));
    expect(screen.queryByText("ICP fit")).toBeNull();
  });

  it("surfaces start_enrichment_run's confirmed result instead of discarding it", async () => {
    const preview: ToolActionPreview = {
      toolName: "start_enrichment_run",
      scope: "Enrich 25 rows in Workbook A",
      assumptions: [],
      affectedRecordCount: 25,
      creditCost: 25,
      externalSideEffects: [],
      args: { workbookId: "wb-1", listId: "l-1", mode: "sample" },
    };
    mockChat.mockResolvedValue({
      reply: "Ready to start the enrichment run.",
      action: { type: "none" },
      applied: false,
      toolPreview: preview,
    });
    mockExecuteTool.mockResolvedValue({
      result: {
        success: true,
        runId: "run-1",
        status: "queued",
        totalRows: 25,
        path: "/workbooks/wb-1/runs/run-1",
        message: "Enrichment run started — processing 25 row(s).",
      },
      applied: true,
    });

    renderChat();
    await openPanelAndSend("start enriching workbook A");

    await waitFor(() => screen.getByText("Confirm and run"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and run" }));

    await waitFor(() => screen.getByText("Enrichment run started — processing 25 row(s)."));
    expect(screen.getByRole("button", { name: /Open Enrichment Run/ })).toBeTruthy();
  });

  it("lets a user switch personas and passes the selection through to the chat call (§8.13 SP-14)", async () => {
    mockChat.mockResolvedValue({ reply: "Sure.", action: { type: "none" }, applied: false });

    renderChat();
    fireEvent.click(screen.getByTestId("dexter-fab"));

    const select = screen.getByTestId("dexter-persona-select") as HTMLSelectElement;
    expect(select.value).toBe("");
    // All 4 personas are selectable.
    expect(screen.getByRole("option", { name: "Sales" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "CRM Data" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Meeting/Call" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "GTM Strategy" })).toBeTruthy();

    fireEvent.change(select, { target: { value: "crm_data" } });
    expect(select.value).toBe("crm_data");

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "who owns acme corp" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to Dexter" }));

    await waitFor(() => screen.getByText("Sure."));
    expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({ persona: "crm_data" }));
  });

  it("defaults to no persona (general assistant) when the user never switches", async () => {
    mockChat.mockResolvedValue({ reply: "Sure.", action: { type: "none" }, applied: false });

    renderChat();
    await openPanelAndSend("hi");

    await waitFor(() => screen.getByText("Sure."));
    expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({ persona: undefined }));
  });

  it("surfaces draft_content's confirmed result instead of discarding it", async () => {
    const preview: ToolActionPreview = {
      toolName: "draft_content",
      scope: 'Draft an email to prospect "p-1"',
      assumptions: [],
      affectedRecordCount: 1,
      creditCost: 0,
      externalSideEffects: [],
      args: { prospectId: "p-1", prompt: "follow up" },
    };
    mockChat.mockResolvedValue({
      reply: "I'll draft that for review.",
      action: { type: "none" },
      applied: false,
      toolPreview: preview,
    });
    mockExecuteTool.mockResolvedValue({
      result: {
        success: true,
        draftId: "draft-1",
        subject: "Following up",
        status: "pending_review",
        path: "/ai/drafts",
        message: 'Draft "Following up" created and pending review.',
      },
      applied: true,
    });

    renderChat();
    await openPanelAndSend("draft a follow-up email");

    await waitFor(() => screen.getByText("Confirm and run"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and run" }));

    await waitFor(() => screen.getByText('Draft "Following up" created and pending review.'));
    expect(screen.getByRole("button", { name: /Open AI Review/ })).toBeTruthy();
  });
});
