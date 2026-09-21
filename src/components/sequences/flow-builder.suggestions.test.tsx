import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowBuilder } from "./flow-builder";
import type { SequenceStep } from "@/types/api";

const mockSuggestStep = vi.fn();
vi.mock("@/lib/sequences", () => ({
  useSequencesApi: () => ({ suggestStep: mockSuggestStep }),
}));

const SUGGESTION = {
  angle: "Warm intro",
  subject: "Quick idea for {{companyName}}",
  body: "<p>Hi {{firstName}}, saw your work.</p>",
};

function step(over: Partial<SequenceStep> = {}): SequenceStep {
  return {
    id: "step-1",
    sequenceId: "seq-1",
    stepOrder: 1,
    stepType: "email",
    delayDays: 0,
    delayUnit: "days",
    subject: "",
    bodyTemplate: "",
    variants: [],
    createdAt: "2026-09-21T00:00:00Z",
    ...over,
  };
}

function renderBuilder(steps: SequenceStep[]) {
  const onUpdateStep = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <FlowBuilder steps={steps} onAddStep={vi.fn()} onUpdateStep={onUpdateStep} onDeleteStep={vi.fn()} />
    </QueryClientProvider>
  );
  // the flow node's main button is the only `w-full text-left` button before a dialog opens
  fireEvent.click(utils.container.querySelector("button.w-full.text-left")!);
  return { onUpdateStep, ...utils };
}

const subjectInputs = () => screen.getAllByPlaceholderText("Subject") as HTMLInputElement[];
const bodyInputs = () => screen.getAllByPlaceholderText("Message body") as HTMLTextAreaElement[];
const variantInputs = () => ({ subjects: subjectInputs(), bodies: bodyInputs() });

describe("FlowBuilder step editor — AI suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestStep.mockResolvedValue({ suggestions: [SUGGESTION] });
  });
  afterEach(() => cleanup());

  it("auto-suggests for a blank email step and fills Variant A when a card is picked, then saves it", async () => {
    const { onUpdateStep } = renderBuilder([step()]);

    await screen.findByText("Warm intro");
    expect(mockSuggestStep).toHaveBeenCalledWith("seq-1", {
      stepType: "email",
      stepId: "step-1",
      excludeAngles: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /Use in Variant A/ }));

    const { subjects, bodies } = variantInputs();
    expect(subjects[0]!.value).toBe(SUGGESTION.subject);
    expect(bodies[0]!.value).toBe(SUGGESTION.body);
    expect(subjects[1]!.value).toBe(""); // Variant B untouched

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onUpdateStep).toHaveBeenCalledTimes(1));
    const patch = onUpdateStep.mock.calls[0]![1];
    expect(patch.variants[0]).toMatchObject({
      variantKey: "A",
      subject: SUGGESTION.subject,
      bodyTemplate: SUGGESTION.body,
    });
    expect(patch.subject).toBe(SUGGESTION.subject);
  });

  it("does not auto-fetch over existing copy, and offers the next blank variant", async () => {
    renderBuilder([
      step({
        subject: "Existing",
        bodyTemplate: "<p>Old</p>",
        variants: [
          { id: "v-a", stepId: "step-1", variantKey: "A", subject: "Existing", bodyTemplate: "<p>Old</p>", weight: 50, enabled: true },
        ] as SequenceStep["variants"],
      }),
    ]);

    expect(mockSuggestStep).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /suggest ideas/i }));
    await screen.findByText("Warm intro");

    fireEvent.click(screen.getByRole("button", { name: /Use in Variant B/ }));

    const { subjects, bodies } = variantInputs();
    expect(subjects[0]!.value).toBe("Existing"); // Variant A preserved
    expect(bodies[0]!.value).toBe("<p>Old</p>");
    expect(subjects[1]!.value).toBe(SUGGESTION.subject);
    expect(bodies[1]!.value).toBe(SUGGESTION.body);
  });

  it("says so plainly when the only option is replacing Variant A", async () => {
    const filled = (key: "A" | "B") =>
      ({ id: `v-${key}`, stepId: "step-1", variantKey: key, subject: `S-${key}`, bodyTemplate: `B-${key}`, weight: 50, enabled: true });
    renderBuilder([step({ subject: "S-A", bodyTemplate: "B-A", variants: [filled("A"), filled("B")] as SequenceStep["variants"] })]);

    fireEvent.click(screen.getByRole("button", { name: /suggest ideas/i }));
    await screen.findByText("Warm intro");
    screen.getByRole("button", { name: /Replace Variant A/ });
  });

  it("suggests body-only copy for a LinkedIn connect step", async () => {
    mockSuggestStep.mockResolvedValueOnce({
      suggestions: [{ angle: "Shared interest", body: "Hi {{firstName}}, love your posts." }],
    });
    renderBuilder([step({ stepType: "linkedin", linkedinAction: "connect" })]);

    await screen.findByText("Shared interest");
    expect(mockSuggestStep).toHaveBeenCalledWith("seq-1", {
      stepType: "linkedin",
      linkedinAction: "connect",
      stepId: "step-1",
      excludeAngles: [],
    });
    fireEvent.click(screen.getByRole("button", { name: /Use in Variant A/ }));
    expect(bodyInputs()[0]!.value).toBe("Hi {{firstName}}, love your posts.");
    expect(screen.queryByPlaceholderText("Subject")).toBeNull(); // LinkedIn has no subject
  });

  it("offers nothing for LinkedIn actions that have no copy (like / follow / voice)", () => {
    renderBuilder([step({ stepType: "linkedin", linkedinAction: "like" })]);
    expect(screen.queryByRole("button", { name: /suggest ideas/i })).toBeNull();
    expect(screen.queryByText(/AI suggestions/i)).toBeNull();
    expect(mockSuggestStep).not.toHaveBeenCalled();
  });
});
