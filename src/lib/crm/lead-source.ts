/** Where a company or deal came from (the API's LEAD_SOURCES). */
export const LEAD_SOURCES = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "referral", label: "Referral" },
  { value: "partner", label: "Partner" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];

export const leadSourceLabel = (v: string | null | undefined) => LEAD_SOURCES.find((s) => s.value === v)?.label ?? null;

/** Placeholder for the detail box, per source. */
export const leadSourceDetailHint = (v: string | null | undefined) =>
  v === "referral" ? "Who referred them" : v === "event" ? "Which event" : v === "partner" ? "Which partner" : v === "outbound" ? "Campaign or channel" : v === "inbound" ? "Page, form or campaign" : "Say where from";
