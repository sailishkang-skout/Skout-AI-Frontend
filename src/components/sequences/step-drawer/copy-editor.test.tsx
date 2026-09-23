import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyEditor } from "./copy-editor";

// TipTap can't run in jsdom; stand in a textarea that, like TipTap, reads its content only on mount.
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

afterEach(cleanup);

describe("CopyEditor — plain", () => {
  it("edits text and shows a length counter", () => {
    const onChange = vi.fn();
    render(<CopyEditor kind="plain" ariaLabel="Message body" value="Hello" maxLength={300} onChange={onChange} />);
    screen.getByText("5/300");
    fireEvent.change(screen.getByLabelText("Message body"), { target: { value: "Hello there" } });
    expect(onChange).toHaveBeenCalledWith("Hello there");
  });

  it("flags text over the limit without blocking it", () => {
    render(<CopyEditor kind="plain" ariaLabel="Message body" value={"x".repeat(310)} maxLength={300} onChange={vi.fn()} />);
    expect(screen.getByText("310/300").className).toContain("text-destructive");
  });

  it("shows no counter without a limit", () => {
    render(<CopyEditor kind="plain" ariaLabel="Message body" value="Hi" onChange={vi.fn()} />);
    expect(screen.queryByText(/\/\d+$/)).toBeNull();
  });

  it("has no variable menu unless asked", () => {
    render(<CopyEditor kind="plain" ariaLabel="Message body" value="Hi" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Variable" })).toBeNull();
  });

  it("inserts a variable at the caret when withVariables is on", () => {
    const onChange = vi.fn();
    render(<CopyEditor kind="plain" ariaLabel="Message body" value="Hi , welcome" withVariables onChange={onChange} />);
    (screen.getByLabelText("Message body") as HTMLTextAreaElement).setSelectionRange(3, 3);

    fireEvent.click(screen.getByRole("button", { name: "Variable" }));
    fireEvent.click(screen.getByRole("button", { name: /\{\{firstName\}\}/ }));
    expect(onChange).toHaveBeenCalledWith("Hi {{firstName}}, welcome");
  });
});

describe("CopyEditor — rich", () => {
  it("passes content in and changes out", () => {
    const onChange = vi.fn();
    render(<CopyEditor kind="rich" value="<p>Hi</p>" onChange={onChange} resetKey="A:0" />);
    const editor = screen.getByTestId("rich-editor") as HTMLTextAreaElement;
    expect(editor.value).toBe("<p>Hi</p>");
    fireEvent.change(editor, { target: { value: "<p>Edited</p>" } });
    expect(onChange).toHaveBeenCalledWith("<p>Edited</p>");
  });

  it("remounts with new content when resetKey changes", () => {
    const { rerender } = render(<CopyEditor kind="rich" value="<p>One</p>" onChange={vi.fn()} resetKey="A:0" />);
    rerender(<CopyEditor kind="rich" value="<p>Two</p>" onChange={vi.fn()} resetKey="A:1" />);
    expect((screen.getByTestId("rich-editor") as HTMLTextAreaElement).value).toBe("<p>Two</p>");
  });

  it("keeps the editor's own content when only value changes (it is uncontrolled)", () => {
    const { rerender } = render(<CopyEditor kind="rich" value="<p>One</p>" onChange={vi.fn()} resetKey="A:0" />);
    rerender(<CopyEditor kind="rich" value="<p>Two</p>" onChange={vi.fn()} resetKey="A:0" />);
    expect((screen.getByTestId("rich-editor") as HTMLTextAreaElement).value).toBe("<p>One</p>");
  });
});
