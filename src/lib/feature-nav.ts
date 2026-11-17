/**
 * Early access feature switches (backend source of truth: Skout-AI-Backend
 * packages/shared/src/product-features.ts). This repo cannot import that package, so the keys are
 * copied here; keep both lists in step. A missing switch means ON.
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
] as const;
export type ProductFeature = (typeof PRODUCT_FEATURES)[number];
export type FeatureMap = Record<ProductFeature, boolean>;

/** App routes that belong to each switchable area. */
export const FEATURE_NAV_PREFIXES: Record<ProductFeature, readonly string[]> = {
  ai: ["/ai", "/dexter", "/decisions"],
  sequences: ["/sequences"],
  linkedin: ["/linkedin"],
  inbox: ["/inbox", "/deliverability"],
  enrichment: ["/enrichment"],
  smart_lists: ["/smart-lists"],
  tam: ["/tam"],
  workflows: ["/workflows"],
  crm: ["/crm"],
  warmup: ["/warmup"],
  meeting_voice: [],
  analytics: ["/analytics", "/admin/reporting"],
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
  return features?.[feature] !== false;
}
