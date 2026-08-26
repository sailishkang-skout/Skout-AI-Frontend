import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { LinkedinVoiceWizard } from "./voice-wizard";

const mockGetEligibility = vi.fn().mockResolvedValue({
  data: {
    eligible: true,
    status: "accepted",
    prospectName: "Alex Mercer",
    linkedinUrl: "https://linkedin.com/in/alex-mercer",
  },
});

const mockDraftScript = vi.fn().mockResolvedValue({
  data: {
    scriptText: "Hey Alex, saw your work at CloudScale Analytics. Loved your focus on outbound efficiency.",
    regionalBriefPreview: "Regional Tone: Consultative & Authentic",
    estimatedDurationSeconds: 30,
    prospect: { id: "p-1", name: "Alex Mercer" },
  },
});

const mockSynthesize = vi.fn().mockResolvedValue({
  data: {
    audioBase64: "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw==",
    mimeType: "audio/mpeg",
    voice: "alloy",
    durationEstimateSeconds: 25,
  },
});

const mockCreateHandoff = vi.fn().mockResolvedValue({
  data: {
    id: "handoff-123",
    handoffToken: "token-abc-456",
    status: "handed_off",
    note: "Manual send only",
  },
});

const mockConfirmSent = vi.fn().mockResolvedValue({
  data: {
    id: "handoff-123",
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
  },
});

vi.mock("@/lib/dexter-platform", () => ({
  useDexterPlatformApi: () => ({
    getLinkedinVoiceEligibility: mockGetEligibility,
    draftLinkedinVoiceScript: mockDraftScript,
    synthesizeVoiceAudio: mockSynthesize,
    createLinkedinVoiceHandoff: mockCreateHandoff,
    confirmLinkedinVoiceSent: mockConfirmSent,
  }),
}));

vi.mock("@/lib/api-client", () => ({
  useApiFetch: () => vi.fn().mockResolvedValue({
    data: [
      { id: "p-1", fullName: "Alex Mercer", title: "VP RevOps", companyName: "CloudScale Analytics" },
    ],
  }),
  useAuthReady: () => true,
  CLERK_ENABLED: false,
}));

describe("LinkedinVoiceWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 4-step wizard header and step 1 by default", async () => {
    render(<LinkedinVoiceWizard />);
    expect(screen.getByText("LinkedIn AI Voice Message Studio")).toBeDefined();
    expect(screen.getByText("1. Eligibility")).toBeDefined();
    expect(screen.getByText("2. Script Draft")).toBeDefined();
    expect(screen.getByText("3. Voice Synthesis")).toBeDefined();
    expect(screen.getByText("4. Mobile Handoff")).toBeDefined();
    expect(screen.getByText("Step 1: Select Prospect & Verify Eligibility")).toBeDefined();
  });

  it("completes full flow from Step 1 to Step 4 confirm sent", async () => {
    render(<LinkedinVoiceWizard />);

    // Wait for initial prospect to load
    await waitFor(() => {
      expect(screen.getByText("Alex Mercer — VP RevOps (CloudScale Analytics)")).toBeDefined();
    });

    // Step 1: Click Continue to Script Drafting
    const continueBtns = screen.getAllByRole("button", { name: /Continue to Script Drafting/i });
    fireEvent.click(continueBtns[continueBtns.length - 1]!);

    // Step 2: AI Script Drafting
    await waitFor(() => {
      expect(screen.getByText(/Step 2: AI Script Drafting with Regional Norms/i)).toBeDefined();
    });

    const proceedToVoiceBtn = screen.getByRole("button", { name: /Proceed to Voice Synthesis/i });
    fireEvent.click(proceedToVoiceBtn);

    // Step 3: Voice Synthesis
    await waitFor(() => {
      expect(screen.getByText(/Step 3: Synthetic Voice Synthesis & Audio Preview/i)).toBeDefined();
    });

    const handoffBtn = screen.getByRole("button", { name: /Generate Mobile Handoff/i });
    fireEvent.click(handoffBtn);

    // Step 4: Mobile Handoff & Confirm
    await waitFor(() => {
      expect(screen.getByText(/Step 4: Mobile Send & Timeline Confirmation/i)).toBeDefined();
    });

    const confirmBtn = screen.getByRole("button", { name: /I Have Sent This Voice Message/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Voice Message Confirmed!/i)).toBeDefined();
    });
  });
});

