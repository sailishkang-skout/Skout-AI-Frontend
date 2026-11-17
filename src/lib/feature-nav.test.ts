import { describe, expect, it } from "vitest";
import { PRODUCT_FEATURES, featureForAppPath, isFeatureOn } from "./feature-nav";

describe("feature-nav", () => {
  it("has the twelve backend feature keys", () => {
    expect(PRODUCT_FEATURES).toHaveLength(12);
  });

  it("maps app paths to features", () => {
    expect(featureForAppPath("/sequences/12")).toBe("sequences");
    expect(featureForAppPath("/sequences")).toBe("sequences");
    expect(featureForAppPath("/smart-lists")).toBe("smart_lists");
    expect(featureForAppPath("/crm/deals")).toBe("crm");
    expect(featureForAppPath("/admin/reporting/x")).toBe("analytics");
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
});
