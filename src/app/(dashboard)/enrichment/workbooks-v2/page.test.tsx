import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUN_ACCESS_MESSAGE } from "@/lib/workbook-permissions";
import WorkbooksV2Page from "./page";

const mockPermissions = vi.fn();
vi.mock("@/lib/workspace-role", () => ({
  useWorkspaceRole: () => {
    const keys: string[] = mockPermissions();
    return { permissions: new Set(keys), hasPermission: (key: string) => keys.includes(key), isLoading: false };
  },
}));

describe("Workbooks V2 entry page", () => {
  beforeEach(() => mockPermissions.mockReturnValue(["enrichment:read", "enrichment:capture", "enrichment.run"]));
  afterEach(() => cleanup());

  it("explains the beta and links back to the existing workbooks", () => {
    render(<WorkbooksV2Page />);
    expect(screen.getByRole("heading", { name: /Workbooks V2/ })).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to your workbooks" }).getAttribute("href")).toBe("/enrichment/workbooks");
  });

  it("says nothing about run access to someone who has it", () => {
    render(<WorkbooksV2Page />);
    expect(screen.queryByText(RUN_ACCESS_MESSAGE)).toBeNull();
  });

  it("tells a member without enrichment.run that running and CRM push are for owners and admins", () => {
    mockPermissions.mockReturnValue(["enrichment:read", "enrichment:capture"]);
    render(<WorkbooksV2Page />);
    expect(screen.getByText(RUN_ACCESS_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to your workbooks" })).toBeTruthy();
  });

  it("says nothing while permissions are unknown", () => {
    mockPermissions.mockReturnValue([]);
    render(<WorkbooksV2Page />);
    expect(screen.queryByText(RUN_ACCESS_MESSAGE)).toBeNull();
  });
});
