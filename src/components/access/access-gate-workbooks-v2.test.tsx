import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessState } from "@/lib/access";
import { PRODUCT_FEATURES } from "@/lib/feature-nav";

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/enrichment/workbooks-v2" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.pathname,
}));

// The access check itself is controlled here so loading and failure can be tested.
const access = vi.hoisted(() => ({ result: {} as { data?: unknown; isError: boolean } }));
vi.mock("@/lib/access", () => ({ useAccess: () => access.result }));

import { AccessGate } from "./access-gate";

const general = Object.fromEntries(PRODUCT_FEATURES.map((f) => [f, f !== "workbooks_v2"])) as AccessState["features"];
const state = (features: Partial<AccessState["features"]>, status: AccessState["status"] = "active"): AccessState => ({
  status,
  features: { ...general, ...features },
  request: null,
});

function renderAt(pathname: string) {
  nav.pathname = pathname;
  return render(
    <AccessGate>
      <p>page content</p>
    </AccessGate>
  );
}

const NOT_ON_PLAN = "This isn't on your plan";

describe("AccessGate — WORKBOOKS_V2 route", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("workspace B (flag on): the V2 route is allowed", () => {
    access.result = { data: state({ workbooks_v2: true }), isError: false };
    renderAt("/enrichment/workbooks-v2");
    expect(screen.getByText("page content")).toBeTruthy();
    expect(screen.queryByText(NOT_ON_PLAN)).toBeNull();
  });

  it("workspace A (flag off): direct navigation to the V2 route is blocked", () => {
    access.result = { data: state({ workbooks_v2: false }), isError: false };
    renderAt("/enrichment/workbooks-v2");
    expect(screen.getByText(NOT_ON_PLAN)).toBeTruthy();
    expect(screen.queryByText("page content")).toBeNull();
  });

  it("blocks nested V2 routes too", () => {
    access.result = { data: state({ workbooks_v2: false }), isError: false };
    renderAt("/enrichment/workbooks-v2/some-workbook-id");
    expect(screen.getByText(NOT_ON_PLAN)).toBeTruthy();
  });

  it("an older backend that sends no workbooks_v2 key does not expose V2", () => {
    const { workbooks_v2: _drop, ...twelve } = state({}).features;
    access.result = { data: { status: "active", features: twelve, request: null }, isError: false };
    renderAt("/enrichment/workbooks-v2");
    expect(screen.getByText(NOT_ON_PLAN)).toBeTruthy();
    expect(screen.queryByText("page content")).toBeNull();
  });

  it("still loading: shows the spinner, never the V2 page", () => {
    access.result = { data: undefined, isError: false };
    renderAt("/enrichment/workbooks-v2");
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    expect(screen.queryByText("page content")).toBeNull();
  });

  it("flag check failed with no answer: V2 stays closed", () => {
    access.result = { data: undefined, isError: true };
    renderAt("/enrichment/workbooks-v2");
    expect(screen.getByText(NOT_ON_PLAN)).toBeTruthy();
    expect(screen.queryByText("page content")).toBeNull();
  });

  it("flag check failed after an answer that said off: V2 stays closed", () => {
    access.result = { data: state({ workbooks_v2: false }), isError: true };
    renderAt("/enrichment/workbooks-v2");
    expect(screen.getByText(NOT_ON_PLAN)).toBeTruthy();
  });

  it("a failed refetch after an answer that said on does not lock out an enabled workspace", () => {
    access.result = { data: state({ workbooks_v2: true }), isError: true };
    renderAt("/enrichment/workbooks-v2");
    expect(screen.getByText("page content")).toBeTruthy();
  });

  it("a pending workspace is sent to early access, not shown V2", () => {
    access.result = { data: state({ workbooks_v2: true }, "pending"), isError: false };
    renderAt("/enrichment/workbooks-v2");
    expect(nav.replace).toHaveBeenCalledWith("/early-access");
    expect(screen.queryByText("page content")).toBeNull();
  });
});

describe("AccessGate — existing Workbooks with the flag off", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("the legacy Workbooks page renders when WORKBOOKS_V2 is off", () => {
    access.result = { data: state({ workbooks_v2: false }), isError: false };
    renderAt("/enrichment/workbooks");
    expect(screen.getByText("page content")).toBeTruthy();
  });

  it("the legacy Workbooks page still renders when the V2 flag check fails (fail-open for general areas is unchanged)", () => {
    access.result = { data: undefined, isError: true };
    renderAt("/enrichment/workbooks");
    expect(screen.getByText("page content")).toBeTruthy();
  });

  it("the legacy Workbooks page is still blocked by its own enrichment switch, not by the V2 one", () => {
    access.result = { data: state({ enrichment: false, workbooks_v2: true }), isError: false };
    renderAt("/enrichment/workbooks");
    expect(screen.getByText(NOT_ON_PLAN)).toBeTruthy();
  });

  it("the legacy Workbooks page renders when V2 is on too", () => {
    access.result = { data: state({ workbooks_v2: true }), isError: false };
    renderAt("/enrichment/workbooks");
    expect(screen.getByText("page content")).toBeTruthy();
  });
});
