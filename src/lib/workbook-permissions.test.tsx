import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-client";
import { isRunPermissionError, useWorkbookPermissions } from "./workbook-permissions";

const mockRole = vi.fn();
vi.mock("./workspace-role", () => ({ useWorkspaceRole: () => mockRole() }));

const holding = (keys: string[], isLoading = false) => ({ permissions: new Set(keys), hasPermission: (key: string) => keys.includes(key), isLoading });
const permissionsFor = (keys: string[], isLoading = false) => {
  mockRole.mockReturnValue(holding(keys, isLoading));
  return renderHook(() => useWorkbookPermissions()).result.current;
};

describe("useWorkbookPermissions", () => {
  beforeEach(() => mockRole.mockReset());

  it("lets someone with enrichment.run edit and run", () => {
    expect(permissionsFor(["enrichment:read", "enrichment:capture", "enrichment.run"])).toEqual({ canEdit: true, canRun: true, known: true });
  });

  it("lets a member edit but not run", () => {
    expect(permissionsFor(["enrichment:read", "enrichment:capture", "enrichment:enrich"])).toEqual({ canEdit: true, canRun: false, known: true });
  });

  it("gives a viewer neither", () => {
    expect(permissionsFor(["enrichment:read"])).toEqual({ canEdit: false, canRun: false, known: true });
  });

  it("offers nothing, and claims nothing, until permissions are known", () => {
    expect(permissionsFor([], true)).toEqual({ canEdit: false, canRun: false, known: false });
    expect(permissionsFor([])).toEqual({ canEdit: false, canRun: false, known: false });
  });
});

describe("isRunPermissionError", () => {
  const forbidden = (requiredPermission: string) => new ApiError("forbidden", 403, { code: "FORBIDDEN", details: { requiredPermission } });

  it("recognises the API's refusal of a run or push", () => {
    expect(isRunPermissionError(forbidden("enrichment.run"))).toBe(true);
  });

  it("leaves other failures to their own handling", () => {
    for (const error of [
      forbidden("enrichment:capture"),
      new ApiError("feature_disabled", 403, { error: "feature_disabled" }),
      new ApiError("forbidden", 403),
      new ApiError("not built", 501, { details: { requiredPermission: "enrichment.run" } }),
      new Error("network"),
      null,
    ]) {
      expect(isRunPermissionError(error)).toBe(false);
    }
  });
});
