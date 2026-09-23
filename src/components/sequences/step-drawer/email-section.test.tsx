import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceStep } from "@/types/api";
import { EmailSection } from "./email-section";
import { saveTemplate } from "./email-templates";
import { SectionHarness } from "./section-harness";
import type { StepDraft } from "./step-draft";
import { mkStep, mkVariant } from "./test-fixtures";

const mockSuggestStep = vi.fn();
vi.mock("@/lib/sequences", () => ({
  useSequencesApi: () => ({ suggestStep: mockSuggestStep }),
}));
vi.mock("./rich-email-editor", async () => {
  const { createElement } = await import("react");
  return {
    RichEmailEditor: ({ initialContent, onChange }: { initialContent: string; onChange: (html: string) => void }) =>
      createElement("textarea", {
        "data-testid": "rich-editor",
        defaultValue: initialContent,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      }),
  };
});

const SUGGESTION = {
  angle: "Warm intro",
  subject: "Quick idea for {{companyName}}",
  body: "<p>Hi {{firstName}}, saw your work.</p>",
};

function renderEmail(step: SequenceStep) {
  const onDraft = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SectionHarness Section={EmailSection} step={step} onDraft={onDraft} />
    </QueryClientProvider>
  );
  return { latest: () => onDraft.mock.calls[onDraft.mock.calls.length - 1]![0] as StepDraft };
}

const subject = () => screen.getByLabelText("Subject") as HTMLInputElement;
const editor = () => screen.getByTestId("rich-editor") as HTMLTextAreaElement;
const filled = (key: "A" | "B", n: string) =>
  mkVariant(key, { subject: `S-${n}`, bodyTemplate: `<p>B-${n}</p>` });
const weights = (d: StepDraft) => [d.variants.A.weight, d.variants.B.weight, d.variants.C.weight];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockSuggestStep.mockResolvedValue({ suggestions: [SUGGESTION] });
});
afterEach(cleanup);

describe("EmailSection — suggestions", () => {
  it("auto-suggests for a blank step and fills Variant A when a card is picked", async () => {
    const { latest } = renderEmail(mkStep());

    await screen.findByText("Warm intro");
    expect(mockSuggestStep).toHaveBeenCalledWith("seq-1", { stepType: "email", stepId: "step-1", excludeAngles: [] });

    fireEvent.click(screen.getByRole("button", { name: /Use in Variant A/ }));
    expect(subject().value).toBe(SUGGESTION.subject);
    expect(editor().value).toBe(SUGGESTION.body);
    expect(latest().variants.A).toEqual({ subject: SUGGESTION.subject, body: SUGGESTION.body, weight: 50 });
    expect(latest().variants.B.subject).toBe(""); // Variant B untouched
  });

  it("does not auto-fetch over existing copy, and offers the next blank variant", async () => {
    renderEmail(mkStep({ subject: "S-A", bodyTemplate: "<p>B-A</p>", variants: [filled("A", "A"), mkVariant("B")] }));
    expect(mockSuggestStep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /suggest ideas/i }));
    await screen.findByText("Warm intro");
    fireEvent.click(screen.getByRole("button", { name: /Use in Variant B/ }));

    // the drawer jumps to Variant B, which now holds the suggestion
    expect(subject().value).toBe(SUGGESTION.subject);
    expect(editor().value).toBe(SUGGESTION.body);
    // Variant A is preserved
    fireEvent.click(screen.getByRole("tab", { name: /^A/ }));
    expect(subject().value).toBe("S-A");
    expect(editor().value).toBe("<p>B-A</p>");
  });

  it("says plainly when the only option is replacing Variant A", async () => {
    renderEmail(mkStep({ subject: "S-A", bodyTemplate: "<p>B-A</p>", variants: [filled("A", "A"), filled("B", "B")] }));
    fireEvent.click(screen.getByRole("button", { name: /suggest ideas/i }));
    await screen.findByText("Warm intro");
    screen.getByRole("button", { name: /Replace Variant A/ });
  });
});

describe("EmailSection — editing", () => {
  const withA = () => mkStep({ subject: "S-A", bodyTemplate: "<p>B-A</p>", variants: [filled("A", "A"), mkVariant("B")] });

  it("edits the active variant's subject and body", () => {
    const { latest } = renderEmail(withA());
    fireEvent.change(subject(), { target: { value: "New subject" } });
    fireEvent.change(editor(), { target: { value: "<p>New body</p>" } });
    expect(latest().variants.A).toMatchObject({ subject: "New subject", body: "<p>New body</p>" });

    fireEvent.click(screen.getByRole("tab", { name: /^B/ }));
    expect(subject().value).toBe("");
    fireEvent.change(subject(), { target: { value: "B subject" } });
    expect(latest().variants.B.subject).toBe("B subject");
    expect(latest().variants.A.subject).toBe("New subject");
  });

  it("shows the timing row", () => {
    renderEmail(withA());
    screen.getByLabelText("Delay amount");
  });
});

describe("EmailSection — God Mode", () => {
  const withA = () => mkStep({ subject: "S-A", bodyTemplate: "<p>B-A</p>", variants: [filled("A", "A"), mkVariant("B")] });

  it("adds C with a 20% share, and removing it folds traffic back", () => {
    const { latest } = renderEmail(withA());
    fireEvent.click(screen.getByRole("button", { name: "+ C · God Mode" }));
    screen.getByRole("tab", { name: /^C · 20%/ });
    expect(latest().godMode).toBe(true);
    expect(weights(latest())).toEqual([40, 40, 20]);

    fireEvent.click(screen.getByRole("tab", { name: /^C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove C" }));
    expect(latest().godMode).toBe(false);
    expect(weights(latest())).toEqual([50, 50, 0]);
    // removing the C you were on returns you to A
    expect(screen.getByRole("tab", { name: /^A/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("rebalances the other variants when one share is typed", () => {
    const { latest } = renderEmail(withA());
    fireEvent.click(screen.getByRole("button", { name: "+ C · God Mode" }));
    fireEvent.change(screen.getByLabelText("Variant A traffic %"), { target: { value: "60" } });
    expect(weights(latest())).toEqual([60, 27, 13]);
  });
});

describe("EmailSection — templates", () => {
  it("applies a saved template to the active variant", () => {
    saveTemplate({ name: "Intro", html: "<p>Template body</p>", subject: "Template subject" });
    renderEmail(mkStep({ subject: "S-A", bodyTemplate: "<p>B-A</p>", variants: [filled("A", "A"), mkVariant("B")] }));

    fireEvent.click(screen.getByRole("button", { name: "Templates" }));
    fireEvent.click(screen.getByRole("button", { name: "Intro" }));
    expect(subject().value).toBe("Template subject");
    expect(editor().value).toBe("<p>Template body</p>");
  });
});

describe("EmailSection — variables", () => {
  it("inserts a variable into the subject at the caret", () => {
    renderEmail(mkStep({ subject: "S-A", bodyTemplate: "<p>B-A</p>", variants: [filled("A", "A"), mkVariant("B")] }));
    subject().setSelectionRange(0, 0);

    fireEvent.click(screen.getByRole("button", { name: "Variable" }));
    fireEvent.click(screen.getByRole("button", { name: /\{\{firstName\}\}/ }));
    expect(subject().value).toBe("{{firstName}}S-A");
  });

  it("inserts a variable with a fallback", () => {
    renderEmail(mkStep({ subject: "Hi ", bodyTemplate: "<p>B-A</p>", variants: [mkVariant("A", { subject: "Hi ", bodyTemplate: "<p>B-A</p>" })] }));
    subject().setSelectionRange(3, 3);

    fireEvent.click(screen.getByRole("button", { name: "Variable" }));
    fireEvent.click(screen.getByRole("button", { name: "Add fallback for First name" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(subject().value).toBe("Hi {{firstName|there}}");
  });
});
