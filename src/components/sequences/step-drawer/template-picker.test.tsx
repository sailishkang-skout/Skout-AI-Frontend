import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatePicker } from "./template-picker";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function setup(props: { subject?: string; html?: string } = {}) {
  const onApply = vi.fn();
  render(<TemplatePicker subject={props.subject ?? "Subj"} html={props.html ?? "<p>Body</p>"} onApply={onApply} />);
  fireEvent.click(screen.getByRole("button", { name: "Templates" }));
  return { onApply };
}

describe("TemplatePicker", () => {
  it("starts empty", () => {
    setup();
    screen.getByText("No saved templates yet");
  });

  it("saves the current copy as a template, then applies it on click", () => {
    const { onApply } = setup({ subject: "Quick idea", html: "<p>Hello</p>" });
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Intro" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    fireEvent.click(screen.getByRole("button", { name: "Intro" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Intro", html: "<p>Hello</p>", subject: "Quick idea" })
    );
    // the menu closes after applying
    expect(screen.queryByLabelText("Template name")).toBeNull();
  });

  it("deletes a template", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Temp" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete template Temp" }));
    screen.getByText("No saved templates yet");
  });

  it("won't save without a name or with an empty body", () => {
    setup({ html: "" });
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Named" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
