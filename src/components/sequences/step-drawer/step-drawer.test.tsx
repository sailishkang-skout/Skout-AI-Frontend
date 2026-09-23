import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceStep } from "@/types/api";
import { StepDrawer } from "./step-drawer";
import { mkStep } from "./test-fixtures";

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

const wait = mkStep({ stepType: "wait", delayDays: 2, delayUnit: "days" });

function setup(step: SequenceStep | null) {
  const handlers = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (s: SequenceStep | null) => (
    <QueryClientProvider client={client}>
      <StepDrawer step={s} steps={s ? [s] : []} {...handlers} />
    </QueryClientProvider>
  );
  const utils = render(ui(step));
  return { ...handlers, showStep: (s: SequenceStep | null) => utils.rerender(ui(s)) };
}

const amount = () => screen.getByLabelText("Delay amount") as HTMLInputElement;
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  vi.clearAllMocks();
  mockSuggestStep.mockResolvedValue({ suggestions: [] });
});
afterEach(cleanup);

describe("StepDrawer", () => {
  it("renders nothing without a step", () => {
    setup(null);
    expect(document.querySelector("aside")).toBeNull();
  });

  it("titles the drawer by step type and number, and shows that type's section", () => {
    setup(wait);
    screen.getByText("Edit Delay");
    screen.getByText("Step 1");
    screen.getByText(/Prospects wait 2 days here/);
  });

  it("renders the email section for an email step", () => {
    setup(mkStep({ stepType: "email" }));
    screen.getByText("Edit Email");
    screen.getByLabelText("Subject");
  });

  it("saves the draft as an update patch, then closes", async () => {
    const { onSave, onClose } = setup(wait);
    fireEvent.change(amount(), { target: { value: "4" } });
    click("Save");
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("step-1", { delayDays: 4, delayUnit: "days" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("stays open and shows the error when saving fails", async () => {
    const { onSave, onClose } = setup(wait);
    onSave.mockRejectedValueOnce(new Error("Unknown merge token: {{nickname}}"));
    fireEvent.change(amount(), { target: { value: "4" } });
    click("Save");
    await screen.findByText("Unknown merge token: {{nickname}}");
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Save while a save is in flight", async () => {
    const { onSave } = setup(wait);
    onSave.mockReturnValueOnce(new Promise(() => {}));
    click("Save");
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true));
  });
});

describe("StepDrawer — closing", () => {
  it("closes straight away when nothing changed", () => {
    const { onClose } = setup(wait);
    click("Cancel");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding edits", () => {
    const { onClose } = setup(wait);
    fireEvent.change(amount(), { target: { value: "3" } });
    click("Cancel");
    screen.getByText("Discard your changes?");
    expect(onClose).not.toHaveBeenCalled();

    click("Keep editing");
    expect(screen.queryByText("Discard your changes?")).toBeNull();
    expect(amount().value).toBe("3");

    click("Cancel");
    click("Discard");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies the same guard to Escape", () => {
    const { onClose } = setup(wait);
    fireEvent.change(amount(), { target: { value: "3" } });
    fireEvent.keyDown(document, { key: "Escape" });
    screen.getByText("Discard your changes?");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("StepDrawer — delete and switching steps", () => {
  it("confirms before deleting, then deletes and closes", async () => {
    const { onDelete, onClose } = setup(wait);
    click("Delete");
    screen.getByText("Delete this step?");
    expect(onDelete).not.toHaveBeenCalled();

    click("Delete step");
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("step-1"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("can back out of a delete", () => {
    const { onDelete } = setup(wait);
    click("Delete");
    click("Keep step");
    expect(screen.queryByText("Delete this step?")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("starts from a fresh draft when a different step is opened", () => {
    const { showStep } = setup(wait);
    fireEvent.change(amount(), { target: { value: "9" } });
    showStep(mkStep({ id: "step-2", stepOrder: 2, stepType: "wait", delayDays: 7, delayUnit: "days" }));
    expect(amount().value).toBe("7");
    expect(screen.queryByText("Discard your changes?")).toBeNull();
  });

  it("disappears when the step is no longer there", () => {
    const { showStep } = setup(wait);
    showStep(null);
    expect(document.querySelector("aside")).toBeNull();
  });
});
