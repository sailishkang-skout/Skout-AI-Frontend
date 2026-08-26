import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { LinkedinVoiceWizard } from "./voice-wizard";

const mockGetEligibility = vi.fn();
const mockDraftScript = vi.fn();
const mockSynthesize = vi.fn();
const mockCreateHandoff = vi.fn();
const mockConfirmSent = vi.fn();

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
  useApiFetch: () =>
    vi.fn().mockResolvedValue({
      data: [
        {
          prospectId: "p-1",
          snapshot: {
            fullName: "Alex Mercer",
            title: "VP RevOps",
            companyName: "CloudScale Analytics",
            linkedinUrl: "https://linkedin.com/in/alex-mercer",
          },
        },
      ],
    }),
  useAuthReady: () => true,
  CLERK_ENABLED: false,
}));

describe("LinkedinVoiceWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEligibility.mockResolvedValue({
      data: {
        eligible: true,
        status: "accepted",
        prospectName: "Alex Mercer",
        linkedinUrl: "https://linkedin.com/in/alex-mercer",
      },
    });
    mockDraftScript.mockResolvedValue({
      data: {
        scriptText: "Hey Alex, saw your work at CloudScale Analytics.",
        regionalBriefPreview: "Regional tone: consultative",
        estimatedDurationSeconds: 30,
        language: "en",
        evidence: { unverified: true, location: "US", tone: "consultative", citations: [] },
        prospect: { id: "p-1", name: "Alex Mercer" },
      },
    });
    mockCreateHandoff.mockResolvedValue({
      data: {
        id: "handoff-123",
        handoffToken: "token-abc-456",
        status: "handed_off",
        voiceChoice: "personal",
        syntheticProfile: null,
        mobileUrl: "http://localhost:3000/linkedin/voice/h/token-abc-456",
        note: "Manual send only",
      },
    });
    mockConfirmSent.mockResolvedValue({
      data: { id: "handoff-123", status: "confirmed", confirmedAt: new Date().toISOString() },
    });
  });

  it("renders the 4-step wizard and keeps Continue disabled until eligibility passes", async () => {
    render(<LinkedinVoiceWizard />);
    expect(screen.getByText("LinkedIn voice notes")).toBeDefined();
    expect(screen.getByText("1. Eligibility")).toBeDefined();
    const continueBtn = await screen.findByRole("button", { name: /Continue to script/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks draft until the 1st-degree check succeeds, then completes personal handoff without TTS", async () => {
    render(<LinkedinVoiceWizard />);

    await waitFor(() => {
      expect(screen.getByText(/Alex Mercer — VP RevOps \(CloudScale Analytics\)/)).toBeDefined();
    });

    const verifyBtns = screen.getAllByRole("button", { name: /Verify 1st-degree connection/i });
    fireEvent.click(verifyBtns[verifyBtns.length - 1]!);
    await waitFor(() => expect(mockGetEligibility).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole("button", { name: /Continue to script/i }).at(-1)!);
    await waitFor(() => {
      expect(mockDraftScript).toHaveBeenCalled();
      expect(screen.getByText(/Review the spoken script/i)).toBeDefined();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Continue to voice/i }).at(-1)!);
    await waitFor(() => {
      expect(screen.getByText(/Personal voice \(recommended\)/i)).toBeDefined();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Create mobile handoff/i }).at(-1)!);
    await waitFor(() => {
      expect(mockCreateHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          prospectId: "p-1",
          voiceChoice: "personal",
        })
      );
      expect(mockCreateHandoff.mock.calls[0][0].bypassEligibilityCheck).toBeUndefined();
      expect(mockSynthesize).not.toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /I sent this voice message/i }).at(-1)!);
    await waitFor(() => {
      expect(mockConfirmSent).toHaveBeenCalled();
      expect(screen.getByText(/Voice note logged/i)).toBeDefined();
    });
  });
});
