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
});
