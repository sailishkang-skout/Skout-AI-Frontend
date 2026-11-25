import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import WorkbooksV2Page from "./page";

describe("Workbooks V2 entry page", () => {
  afterEach(() => cleanup());

  it("explains the beta and links back to the existing workbooks", () => {
    render(<WorkbooksV2Page />);
    expect(screen.getByRole("heading", { name: /Workbooks V2/ })).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to your workbooks" }).getAttribute("href")).toBe("/enrichment/workbooks");
  });
});
