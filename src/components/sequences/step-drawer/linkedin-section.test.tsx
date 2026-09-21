import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceStep } from "@/types/api";
import { LinkedinSection } from "./linkedin-section";
import { SectionHarness } from "./section-harness";
import type { StepDraft } from "./step-draft";
import { mkStep } from "./test-fixtures";

const mockSuggestStep = vi.fn();
vi.mock("@/lib/sequences", () => ({
  useSequencesApi: () => ({ suggestStep: mockSuggestStep }),
}));

const SUGGESTION = { angle: "Shared interest", body: "Hi {{firstName}}, love your posts." };

function renderLinkedin(over: Partial<SequenceStep> = {}) {
  const onDraft = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SectionHarness
        Section={LinkedinSection}
        step={mkStep({ stepType: "linkedin", linkedinAction: "connect", ...over })}
        onDraft={onDraft}
      />
    </QueryClientProvider>
  );
  return { latest: () => onDraft.mock.calls[onDraft.mock.calls.length - 1]![0] as StepDraft };
}

const body = () => screen.getByLabelText("Message body") as HTMLTextAreaElement;
const radio = (name: RegExp) => screen.getByRole("radio", { name }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockSuggestStep.mockResolvedValue({ suggestions: [SUGGESTION] });
});
afterEach(cleanup);

describe("LinkedinSection — action picker", () => {
  it("offers working actions and disables the ones that aren't built yet", () => {
    renderLinkedin();
    expect(radio(/Connection request/).getAttribute("aria-checked")).toBe("true");
    expect(radio(/Direct message/).disabled).toBe(false);
    expect(radio(/Voice note/).disabled).toBe(false);
    for (const name of [/InMail/, /Like recent posts/, /Follow profile/]) {
      expect(radio(name).disabled).toBe(true);
    }
    expect(screen.getAllByText("Not available yet")).toHaveLength(3);
  });

  it("switches action", () => {
    const { latest } = renderLinkedin();
    fireEvent.click(radio(/Direct message/));
    expect(latest().linkedinAction).toBe("message");
  });

  it("warns, and keeps the choice, on a step that already uses an unsupported action", () => {
    renderLinkedin({ linkedinAction: "inmail" });
    expect(radio(/InMail/).disabled).toBe(false);
    expect(radio(/InMail/).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("alert").textContent).toMatch(/InMail isn't supported yet.*currently sends as a connection request/);
  });
});

describe("LinkedinSection — copy", () => {
  it("auto-suggests body-only copy for a connection request and fills Variant A", async () => {
    const { latest } = renderLinkedin();
    await screen.findByText("Shared interest");
    expect(mockSuggestStep).toHaveBeenCalledWith("seq-1", {
      stepType: "linkedin",
      linkedinAction: "connect",
      stepId: "step-1",
      excludeAngles: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /Use in Variant A/ }));
    expect(body().value).toBe(SUGGESTION.body);
    expect(latest().variants.A.body).toBe(SUGGESTION.body);
    expect(screen.queryByLabelText("Subject")).toBeNull(); // LinkedIn has no subject
    screen.getByText(/\/300$/); // connection notes are capped at 300
  });

  it("edits the active variant's body", () => {
    const { latest } = renderLinkedin({ linkedinAction: "message", bodyTemplate: "Hello" });
    fireEvent.change(body(), { target: { value: "Hello again" } });
    expect(latest().variants.A.body).toBe("Hello again");
    screen.getByText(/\/700$/);
    screen.getByRole("tab", { name: "A · 50%" });
  });

  it("does not offer suggestions for InMail", () => {
    renderLinkedin({ linkedinAction: "inmail" });
    expect(mockSuggestStep).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /suggest ideas/i })).toBeNull();
  });

  it("voice notes have no copy field, only an explanation", () => {
    renderLinkedin({ linkedinAction: "voice" });
    expect(screen.queryByLabelText("Message body")).toBeNull();
    screen.getByText(/LinkedIn has no API to send a voice note automatically/);
    expect(mockSuggestStep).not.toHaveBeenCalled();
  });

  it("like and follow have no copy field", () => {
    renderLinkedin({ linkedinAction: "like" });
    expect(screen.queryByLabelText("Message body")).toBeNull();
    screen.getByText("This action has no message.");
  });
});
