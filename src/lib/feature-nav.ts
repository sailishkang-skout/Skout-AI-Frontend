/**
 * Early access feature switches (backend source of truth: Skout-AI-Backend
 * packages/shared/src/product-features.ts). This repo cannot import that package, so the keys are
 * copied here; keep both lists in step. A missing switch means ON, except the opt-in features
 * (OPT_IN_FEATURES, e.g. WORKBOOKS_V2): those are OFF unless the backend says `true`, so a switch that
 * is missing, still loading or failed to load never exposes a feature in controlled rollout.
 */
export const PRODUCT_FEATURES = [
  "ai",
  "sequences",
  "linkedin",
  "inbox",
  "enrichment",
  "smart_lists",
  "tam",
  "workflows",
  "crm",
  "warmup",
  "meeting_voice",
  "analytics",
  "workbooks_v2",
] as const;
export type ProductFeature = (typeof PRODUCT_FEATURES)[number];

/** Features that are OFF until the backend explicitly grants them to the workspace. Mirrors the backend. */
export const OPT_IN_FEATURES: readonly ProductFeature[] = ["workbooks_v2"];

export function isOptInFeature(feature: ProductFeature): boolean {
  return OPT_IN_FEATURES.includes(feature);
}
export type FeatureMap = Record<ProductFeature, boolean>;

/** App routes that belong to each switchable area. */
export const FEATURE_NAV_PREFIXES: Record<ProductFeature, readonly string[]> = {
  ai: ["/ai", "/dexter", "/decisions"],
  sequences: ["/sequences"],
  linkedin: ["/linkedin"],
  inbox: ["/inbox", "/deliverability"],
  enrichment: ["/enrichment", "/intelligence/email"],
  smart_lists: ["/smart-lists"],
  tam: ["/tam"],
  workflows: ["/workflows"],
  crm: ["/crm", "/admin/revenue"],
  warmup: ["/warmup"],
  meeting_voice: ["/settings/calling", "/settings/numbers"],
  analytics: ["/analytics", "/admin/reporting", "/admin/cro", "/admin/gtm-learning"],
  // The new workbook (WB2-002). The legacy /enrichment/workbooks stays under `enrichment`.
  workbooks_v2: ["/enrichment/workbooks-v2"],
};

const ENTRIES = PRODUCT_FEATURES.flatMap((f) => FEATURE_NAV_PREFIXES[f].map((p) => [p, f] as const)).sort(
  (a, b) => b[0].length - a[0].length
);

/** The feature an app path belongs to (longest matching prefix wins), or null when ungated. */
export function featureForAppPath(pathname: string): ProductFeature | null {
  for (const [prefix, feature] of ENTRIES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return feature;
  }
  return null;
}

export function isFeatureOn(features: Partial<FeatureMap> | undefined, feature: ProductFeature): boolean {
  // Opt-in: only an explicit true counts. General features: only an explicit false turns them off.
  if (isOptInFeature(feature)) return features?.[feature] === true;
  return features?.[feature] !== false;
}
