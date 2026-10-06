import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditViewer } from "./AuditViewer";

describe("AuditViewer field errors", () => {
  afterEach(() => cleanup());

  it("shows each 422 field message next to its filter", () => {
    render(
      <AuditViewer
        rows={[]}
        onQuery={vi.fn()}
        fieldErrors={{ from: "must be an ISO date", search: "too long" }}
      />
    );
    expect(screen.getByText("From date: must be an ISO date")).toBeTruthy();
    expect(screen.getByText("Search: too long")).toBeTruthy();
  });

  it("renders no field alerts when there are no field errors", () => {
    render(<AuditViewer rows={[]} onQuery={vi.fn()} />);
    expect(screen.queryByText(/From date:/)).toBeNull();
  });
});
