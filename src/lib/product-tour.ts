export const TOUR_STORAGE_KEY = "skout.productTour.v1";

export type TourPhase = "welcome" | "tour" | "done";

export interface TourPersisted {
  /** Welcome modal already shown (start or skip). */
  welcomeSeen: boolean;
  /** Tour finished or skipped — don't auto-open again. */
  dismissed: boolean;
  /** Completed all steps (not just skipped). */
  completed: boolean;
}

export interface TourStep {
  id: string;
  /** Matches data-tour on a sidebar/nav element */
  target: string;
  href: string;
  title: string;
  body: string;
}

/** Four guided stops — welcome modal is separate. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    target: "nav-dashboard",
    href: "/dashboard",
    title: "Your command center",
    body: "Dashboard shows credits, lists, and weekly activity. Come back here anytime for a snapshot of this workspace.",
  },
  {
    id: "import",
    target: "nav-import",
    href: "/import",
    title: "Import prospects",
    body: "Upload CSV, Excel, PDF, or images to build a list fast. Preview rows, then commit into a new or existing list.",
  },
  {
    id: "lists",
    target: "nav-lists",
    href: "/lists",
    title: "Lists & enrichment",
    body: "Organize prospects in lists, enrich emails/phones, verify contacts, then enroll into a sequence.",
  },
  {
    id: "sequences",
    target: "nav-sequences",
    href: "/sequences",
    title: "Outreach sequences",
    body: "Build multi-step cadences (email + LinkedIn), use AI Ask/Auto for copy, and track replies in Inbox.",
  },
];

export function loadTourState(): TourPersisted {
  if (typeof window === "undefined") {
    return { welcomeSeen: false, dismissed: false, completed: false };
  }
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return { welcomeSeen: false, dismissed: false, completed: false };
    const parsed = JSON.parse(raw) as Partial<TourPersisted>;
    return {
      welcomeSeen: Boolean(parsed.welcomeSeen),
      dismissed: Boolean(parsed.dismissed),
      completed: Boolean(parsed.completed),
    };
  } catch {
    return { welcomeSeen: false, dismissed: false, completed: false };
  }
}

export function saveTourState(next: TourPersisted): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(next));
}

export function shouldShowWelcome(state: TourPersisted = loadTourState()): boolean {
  return !state.welcomeSeen && !state.dismissed;
}
