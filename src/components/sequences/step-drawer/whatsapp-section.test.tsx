import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SectionHarness } from "./section-harness";
import type { StepDraft } from "./step-draft";
import { mkStep } from "./test-fixtures";
import { WhatsappSection } from "./whatsapp-section";

afterEach(cleanup);

function renderWhatsapp(bodyTemplate: string | null = null) {
  const onDraft = vi.fn();
  render(
    <SectionHarness Section={WhatsappSection} step={mkStep({ stepType: "whatsapp", bodyTemplate })} onDraft={onDraft} />
  );
  return { latest: () => onDraft.mock.calls[onDraft.mock.calls.length - 1]![0] as StepDraft };
}

describe("WhatsappSection", () => {
  it("edits the message as plain text", () => {
    const { latest } = renderWhatsapp("Hi");
    expect((screen.getByLabelText("WhatsApp message") as HTMLTextAreaElement).value).toBe("Hi");
    fireEvent.change(screen.getByLabelText("WhatsApp message"), { target: { value: "Hi {{firstName}}" } });
    expect(latest().body).toBe("Hi {{firstName}}");
  });

  it("offers the variable menu", () => {
    renderWhatsapp("Hi ");
    screen.getByRole("button", { name: "Variable" });
  });

  it("explains what WhatsApp needs, and has timing but no variants", () => {
    renderWhatsapp();
    screen.getByText(/Prospects need a phone number/);
    screen.getByLabelText("Delay amount");
    expect(screen.queryByRole("tab")).toBeNull();
  });
});
