import { describe, expect, it } from "vitest";
import { OPT_IN_FEATURES, PRODUCT_FEATURES, featureForAppPath, isFeatureOn } from "./feature-nav";

describe("feature-nav", () => {
  it("has the twelve general backend feature keys plus the opt-in workbooks_v2", () => {
    expect(PRODUCT_FEATURES).toHaveLength(13);
    expect(PRODUCT_FEATURES.slice(0, 12)).not.toContain("workbooks_v2");
    expect(PRODUCT_FEATURES[12]).toBe("workbooks_v2");
  });

  it("maps app paths to features", () => {
    expect(featureForAppPath("/sequences/12")).toBe("sequences");
    expect(featureForAppPath("/sequences")).toBe("sequences");
    expect(featureForAppPath("/smart-lists")).toBe("smart_lists");
    expect(featureForAppPath("/crm/deals")).toBe("crm");
    expect(featureForAppPath("/admin/reporting/x")).toBe("analytics");
  });

  it("covers the pages that call gated APIs", () => {
    expect(featureForAppPath("/settings/calling")).toBe("meeting_voice");
    expect(featureForAppPath("/settings/numbers")).toBe("meeting_voice");
    expect(featureForAppPath("/intelligence/email/inbox")).toBe("enrichment");
    expect(featureForAppPath("/admin/cro")).toBe("analytics");
    expect(featureForAppPath("/admin/gtm-learning")).toBe("analytics");
    expect(featureForAppPath("/admin/revenue")).toBe("crm");
    expect(featureForAppPath("/settings/team")).toBeNull();
  });

  it("leaves ungated paths alone", () => {
    expect(featureForAppPath("/dashboard")).toBeNull();
    expect(featureForAppPath("/lists")).toBeNull();
    expect(featureForAppPath("/settings/team")).toBeNull();
    expect(featureForAppPath("/aim")).toBeNull();
  });

  it("treats a missing switch as on", () => {
    expect(isFeatureOn(undefined, "ai")).toBe(true);
    expect(isFeatureOn({ ai: false } as never, "ai")).toBe(false);
    expect(isFeatureOn({ ai: false } as never, "crm")).toBe(true);
  });

  describe("WORKBOOKS_V2 (opt-in)", () => {
    it("is the only opt-in feature", () => {
      expect([...OPT_IN_FEATURES]).toEqual(["workbooks_v2"]);
    });

    it("is off unless the backend says true: missing, undefined and false all hide it", () => {
      expect(isFeatureOn(undefined, "workbooks_v2")).toBe(false);
      expect(isFeatureOn({}, "workbooks_v2")).toBe(false);
      expect(isFeatureOn({ workbooks_v2: false } as never, "workbooks_v2")).toBe(false);
      expect(isFeatureOn({ workbooks_v2: undefined } as never, "workbooks_v2")).toBe(false);
      expect(isFeatureOn({ workbooks_v2: "true" } as never, "workbooks_v2")).toBe(false);
      expect(isFeatureOn({ workbooks_v2: 1 } as never, "workbooks_v2")).toBe(false);
      expect(isFeatureOn({ workbooks_v2: true } as never, "workbooks_v2")).toBe(true);
    });

    it("does not change how any general feature reads", () => {
      expect(isFeatureOn({ workbooks_v2: true } as never, "ai")).toBe(true);
      expect(isFeatureOn({ ai: false, workbooks_v2: true } as never, "ai")).toBe(false);
    });

    it("maps the V2 route to workbooks_v2 and keeps the legacy route on enrichment", () => {
      expect(featureForAppPath("/enrichment/workbooks-v2")).toBe("workbooks_v2");
      expect(featureForAppPath("/enrichment/workbooks-v2/abc123")).toBe("workbooks_v2");
      expect(featureForAppPath("/enrichment/workbooks")).toBe("enrichment");
      expect(featureForAppPath("/enrichment/workbooks/abc123")).toBe("enrichment");
      expect(featureForAppPath("/enrichment/workbooks-v22")).toBe("enrichment");
    });
  });
});
