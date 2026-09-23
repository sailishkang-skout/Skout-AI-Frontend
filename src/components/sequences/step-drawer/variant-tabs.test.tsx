import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SequenceVariantKey } from "@/types/api";
import { VariantTabs } from "./variant-tabs";

afterEach(cleanup);

function setup(over: Partial<React.ComponentProps<typeof VariantTabs>> = {}) {
  const handlers = { onActive: vi.fn(), onToggleGodMode: vi.fn(), onSplit: vi.fn() };
  const utils = render(
    <VariantTabs
      godMode={false}
      weights={{ A: 50, B: 50, C: 0 }}
      active={"A" as SequenceVariantKey}
      {...handlers}
      {...over}
    />
  );
  return { ...handlers, ...utils };
}

describe("VariantTabs", () => {
  it("shows A and B with their real share, and offers C", () => {
    setup();
    screen.getByRole("tab", { name: "A · 50%" });
    screen.getByRole("tab", { name: "B · 50%" });
    expect(screen.queryByRole("tab", { name: /^C/ })).toBeNull();
    screen.getByRole("button", { name: "+ C · God Mode" });
    expect(screen.queryByText(/God Mode adds variant C/)).toBeNull();
  });

  it("God Mode shows the real split (50/50/25 is 40/40/20) and a badged C tab", () => {
    const { container } = setup({ godMode: true, weights: { A: 50, B: 50, C: 25 } });
    screen.getByRole("tab", { name: "A · 40%" });
    screen.getByRole("tab", { name: "B · 40%" });
    const cTab = screen.getByRole("tab", { name: /^C · 20%/ });
    expect(cTab.textContent).toContain("God Mode");
    screen.getByText(/God Mode adds variant C/);

    const bar = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(Array.from(bar.children).map((c) => (c as HTMLElement).style.width)).toEqual(["40%", "40%", "20%"]);
  });

  it("marks the active tab and reports tab clicks", () => {
    const { onActive } = setup({ active: "B" });
    expect(screen.getByRole("tab", { name: /^B/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /^A/ }).getAttribute("aria-selected")).toBe("false");
    fireEvent.click(screen.getByRole("tab", { name: /^A/ }));
    expect(onActive).toHaveBeenCalledWith("A");
  });

  it("toggles God Mode on and off", () => {
    const off = setup();
    fireEvent.click(screen.getByRole("button", { name: "+ C · God Mode" }));
    expect(off.onToggleGodMode).toHaveBeenCalledWith(true);
    cleanup();

    const on = setup({ godMode: true, weights: { A: 40, B: 40, C: 20 } });
    fireEvent.click(screen.getByRole("button", { name: "Remove C" }));
    expect(on.onToggleGodMode).toHaveBeenCalledWith(false);
  });

  it("reports typed percentages", () => {
    const { onSplit } = setup();
    fireEvent.change(screen.getByLabelText("Variant A traffic %"), { target: { value: "70" } });
    expect(onSplit).toHaveBeenCalledWith("A", 70);
  });
});
