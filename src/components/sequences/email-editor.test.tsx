import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EmailEditor } from "./email-editor";

// jsdom lacks a few layout APIs ProseMirror probes; stub them so the editor can mount.
beforeAll(() => {
  const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  Range.prototype.getClientRects = emptyRects;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  document.elementFromPoint = () => null;
});

afterEach(cleanup);

describe("EmailEditor toolbar", () => {
  it("offers the Variable menu instead of the old fixed token chips", async () => {
    render(<EmailEditor initialContent="<p>Hi</p>" onChange={vi.fn()} />);
    await screen.findByRole("button", { name: "Variable" });
    expect(screen.queryByText("Insert:")).toBeNull();
    expect(screen.queryByText("{{firstName}}")).toBeNull();
  });
});
