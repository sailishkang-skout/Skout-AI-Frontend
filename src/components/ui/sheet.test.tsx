import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "./sheet";

afterEach(cleanup);

describe("Sheet", () => {
  it("renders a footer outside the scrolling body", () => {
    render(
      <Sheet open onClose={vi.fn()} title="Edit" footer={<button>Footer action</button>}>
        <p>Body content</p>
      </Sheet>
    );
    const body = screen.getByText("Body content").parentElement!;
    const footer = screen.getByText("Footer action");
    expect(body.contains(footer)).toBe(false);
    expect(body.className).toContain("overflow-y-auto");
  });

  it("renders no footer bar when none is given", () => {
    render(
      <Sheet open onClose={vi.fn()} title="Edit">
        <p>Body</p>
      </Sheet>
    );
    // header + body only
    expect(document.querySelector("aside")!.children).toHaveLength(2);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Edit">
        <p>Body</p>
      </Sheet>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
