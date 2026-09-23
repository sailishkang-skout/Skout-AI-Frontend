import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VariableMenu } from "./variable-menu";

afterEach(cleanup);

function setup(props: { disabled?: boolean } = {}) {
  const onPick = vi.fn();
  render(<VariableMenu onPick={onPick} {...props} />);
  return { onPick, open: () => fireEvent.click(screen.getByRole("button", { name: "Variable" })) };
}

/** The list button for a token, found by its `{{name}}` (the "+ fallback" buttons don't contain it). */
const item = (name: string) => screen.getByRole("button", { name: new RegExp(`\\{\\{${name}\\}\\}`) });

describe("VariableMenu — list", () => {
  it("is closed until opened, then lists all nine tokens with a sample", () => {
    const { open } = setup();
    expect(screen.queryByLabelText("Search variables")).toBeNull();
    open();
    expect(screen.getAllByRole("button", { name: /\{\{\w+\}\}/ })).toHaveLength(9);
    expect(item("firstName").textContent).toContain("Ada");
  });

  it("filters by name, label or description", () => {
    const { open } = setup();
    open();
    fireEvent.change(screen.getByLabelText("Search variables"), { target: { value: "compan" } });
    expect(screen.getAllByRole("button", { name: /\{\{\w+\}\}/ })).toHaveLength(2);
    item("companyName");
    item("companyDomain");

    fireEvent.change(screen.getByLabelText("Search variables"), { target: { value: "zzz" } });
    screen.getByText("No variables match");
  });

  it("flags companyDomain as a web address and gives the unsubscribe link no fallback", () => {
    const { open } = setup();
    open();
    screen.getByText(/A web address, not an industry/);
    screen.getByText(/It can't have a fallback/);
    expect(screen.queryByRole("button", { name: "Add fallback for Unsubscribe link" })).toBeNull();
    screen.getByRole("button", { name: "Add fallback for Company website" });
  });
});

describe("VariableMenu — picking", () => {
  it("inserts a plain token and closes", () => {
    const { onPick, open } = setup();
    open();
    fireEvent.click(item("firstName"));
    expect(onPick).toHaveBeenCalledWith("{{firstName}}");
    expect(screen.queryByLabelText("Search variables")).toBeNull();
  });

  it("adds a fallback, pre-filled with a sensible default", () => {
    const { onPick, open } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add fallback for First name" }));
    expect((screen.getByLabelText("Fallback for First name") as HTMLInputElement).value).toBe("there");
    screen.getByText(/Blank recipients see/);

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(onPick).toHaveBeenCalledWith("{{firstName|there}}");
  });

  it("inserts an edited fallback, and starts blank when there is no default", () => {
    const { onPick, open } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add fallback for First name" }));
    fireEvent.change(screen.getByLabelText("Fallback for First name"), { target: { value: "friend" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(onPick).toHaveBeenCalledWith("{{firstName|friend}}");

    open();
    fireEvent.click(screen.getByRole("button", { name: "Add fallback for Last name" }));
    expect((screen.getByLabelText("Fallback for Last name") as HTMLInputElement).value).toBe("");
  });

  it("rejects a fallback the API would refuse, and doesn't insert it", () => {
    const { onPick, open } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add fallback for First name" }));
    const field = screen.getByLabelText("Fallback for First name");

    fireEvent.change(field, { target: { value: "a|b" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(screen.getByRole("alert").textContent).toMatch(/can't contain/);

    fireEvent.change(field, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Enter a fallback/);

    fireEvent.change(field, { target: { value: "x".repeat(61) } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(screen.getByRole("alert").textContent).toMatch(/60/);

    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("VariableMenu — closing and disabled", () => {
  it("closes on an outside click", () => {
    const { open } = setup();
    open();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText("Search variables")).toBeNull();
  });

  it("Escape closes only the menu, not something listening behind it", () => {
    const behind = vi.fn();
    document.addEventListener("keydown", behind);
    const { open } = setup();
    open();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByLabelText("Search variables")).toBeNull();
    expect(behind).not.toHaveBeenCalled();

    // with the menu closed, Escape reaches whatever is behind it again
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(behind).toHaveBeenCalledTimes(1);
    document.removeEventListener("keydown", behind);
  });

  it("can be disabled", () => {
    setup({ disabled: true });
    expect((screen.getByRole("button", { name: "Variable" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
