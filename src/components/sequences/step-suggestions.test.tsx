import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepSuggestions } from "./step-suggestions";

const mockSuggestStep = vi.fn();
vi.mock("@/lib/sequences", () => ({
  useSequencesApi: () => ({ suggestStep: mockSuggestStep }),
}));

const emailCards = [
  { angle: "Warm intro", subject: "Quick idea for {{companyName}}", body: "<p>Hi {{firstName}}, saw your work.</p>" },
  { angle: "Pain point", subject: "Closing the books faster", body: "<p>Most CFOs tell us close takes too long.</p>" },
];

function renderIt(props: Partial<React.ComponentProps<typeof StepSuggestions>> = {}) {
  const onApply = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <StepSuggestions
        sequenceId="seq-1"
        stepId="step-1"
        stepType="email"
        empty
        autoLoad
        onApply={onApply}
        {...props}
      />
    </QueryClientProvider>
  );
  return { onApply, ...utils };
}

describe("StepSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestStep.mockResolvedValue({ suggestions: emailCards });
  });
  afterEach(() => cleanup());

  it("auto-loads suggestion cards for an empty step and applies one on click", async () => {
    const { onApply } = renderIt({ applyLabel: "Use in Variant A" });

    await screen.findByText("Warm intro");
    screen.getByText("Pain point");
    screen.getByText("Quick idea for {{companyName}}");
    expect(mockSuggestStep).toHaveBeenCalledTimes(1);
    expect(mockSuggestStep).toHaveBeenCalledWith("seq-1", {
      stepType: "email",
      stepId: "step-1",
      excludeAngles: [],
    });
    // body preview is plain text, not raw HTML
    screen.getByText(/Hi \{\{firstName\}\}, saw your work\./);
    expect(screen.queryByText(/<p>/)).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /Use in Variant A/ })[0]!);
    expect(onApply).toHaveBeenCalledWith(emailCards[0]);

    // cards collapse after applying; the entry point remains
    await waitFor(() => expect(screen.queryByText("Warm intro")).toBeNull());
    screen.getByRole("button", { name: /suggest ideas/i });
  });

  it("does not call the API on mount when autoLoad is off, only after the user asks", async () => {
    renderIt({ autoLoad: false });
    expect(mockSuggestStep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /suggest ideas/i }));
    await screen.findByText("Warm intro");
    expect(mockSuggestStep).toHaveBeenCalledTimes(1);
  });

  it("does not auto-load over content the user already wrote", () => {
    renderIt({ empty: false });
    expect(mockSuggestStep).not.toHaveBeenCalled();
    screen.getByRole("button", { name: /suggest ideas/i });
  });

  it("passes the LinkedIn action and shows body-only cards", async () => {
    mockSuggestStep.mockResolvedValueOnce({
      suggestions: [{ angle: "Shared interest", body: "Hi {{firstName}}, love your posts on finance." }],
    });
    renderIt({ stepType: "linkedin", linkedinAction: "connect" });

    await screen.findByText("Shared interest");
    expect(mockSuggestStep).toHaveBeenCalledWith("seq-1", {
      stepType: "linkedin",
      linkedinAction: "connect",
      stepId: "step-1",
      excludeAngles: [],
    });
  });

  it.each([
    ["like", "linkedin"],
    ["follow", "linkedin"],
    ["voice", "linkedin"],
  ] as const)("renders nothing for unsupported LinkedIn action %s", (action, stepType) => {
    const { container } = renderIt({ stepType, linkedinAction: action });
    expect(container.firstChild).toBeNull();
    expect(mockSuggestStep).not.toHaveBeenCalled();
  });

  it.each(["call", "wait", "task", "condition", "goal", "whatsapp"] as const)(
    "renders nothing for %s steps",
    (stepType) => {
      const { container } = renderIt({ stepType });
      expect(container.firstChild).toBeNull();
      expect(mockSuggestStep).not.toHaveBeenCalled();
    }
  );

  it("asks for different angles when refreshed", async () => {
    renderIt();
    await screen.findByText("Warm intro");

    mockSuggestStep.mockResolvedValueOnce({
      suggestions: [{ angle: "Social proof", subject: "How Acme cut close time", body: "<p>Fresh.</p>" }],
    });
    fireEvent.click(screen.getByRole("button", { name: /new ideas/i }));

    await screen.findByText("Social proof");
    expect(mockSuggestStep).toHaveBeenLastCalledWith("seq-1", {
      stepType: "email",
      stepId: "step-1",
      excludeAngles: ["Warm intro", "Pain point"],
    });
    expect(screen.queryByText("Warm intro")).toBeNull();
  });

  it("shows a non-blocking error with a retry when suggestions fail", async () => {
    mockSuggestStep.mockRejectedValueOnce(new Error("boom"));
    renderIt();

    await screen.findByText(/couldn.t load suggestions/i);
    mockSuggestStep.mockResolvedValueOnce({ suggestions: emailCards });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByText("Warm intro");
  });
});
