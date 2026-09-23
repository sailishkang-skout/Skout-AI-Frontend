import { afterEach, describe, expect, it, vi } from "vitest";
import { insertAtSelection, insertIntoField } from "./insert-at-cursor";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function input(value: string, start: number, end = start) {
  const el = document.createElement("input");
  el.value = value;
  el.setSelectionRange(start, end);
  return el;
}

describe("insertAtSelection", () => {
  it("inserts at the caret and reports where the caret lands", () => {
    expect(insertAtSelection(input("Hi , welcome", 3), "{{firstName}}")).toEqual({
      value: "Hi {{firstName}}, welcome",
      caret: 16,
    });
  });

  it("replaces a selection", () => {
    expect(insertAtSelection(input("Hi NAME!", 3, 7), "{{firstName}}")).toEqual({
      value: "Hi {{firstName}}!",
      caret: 16,
    });
  });

  it("works in a textarea, and at the very end", () => {
    const el = document.createElement("textarea");
    el.value = "Hello ";
    el.setSelectionRange(6, 6);
    expect(insertAtSelection(el, "{{title}}")).toEqual({ value: "Hello {{title}}", caret: 15 });
  });
});

describe("insertIntoField", () => {
  it("reports the new value, then refocuses the field", () => {
    vi.useFakeTimers();
    const el = input("Hi ", 3);
    document.body.appendChild(el);
    const onChange = vi.fn();

    insertIntoField(el, "{{firstName}}", onChange);
    expect(onChange).toHaveBeenCalledWith("Hi {{firstName}}");

    vi.runAllTimers();
    expect(document.activeElement).toBe(el);
  });

  it("does nothing without a field", () => {
    const onChange = vi.fn();
    insertIntoField(null, "{{firstName}}", onChange);
    expect(onChange).not.toHaveBeenCalled();
  });
});
