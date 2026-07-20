import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  enrichmentNav,
  otherNav,
} from "@/components/workspace/sidebar";
import {
  loadTourState,
  saveTourState,
  shouldShowWelcome,
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  TOUR_WELCOME_CHAPTERS,
} from "./product-tour";

describe("product-tour", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  it("covers every sidebar nav target plus AI chat", () => {
    const navTourIds = [...enrichmentNav, ...otherNav]
      .flatMap((g) => g.items)
      .map((i) => i.tourId)
      .filter((id): id is string => Boolean(id));

    expect(navTourIds.length).toBeGreaterThan(10);
    for (const id of navTourIds) {
      expect(TOUR_STEPS.some((s) => s.target === id), `missing tour step for ${id}`).toBe(true);
    }
    expect(TOUR_STEPS.some((s) => s.target === "nav-ai-chat")).toBe(true);
    expect(TOUR_STEPS.every((s) => s.body.length > 20 && (s.details?.length ?? 0) >= 2)).toBe(true);
  });

  it("has welcome chapters summarizing the full tour", () => {
    expect(TOUR_WELCOME_CHAPTERS).toHaveLength(4);
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(20);
  });

  it("shows welcome for first-time users", () => {
    expect(shouldShowWelcome()).toBe(true);
  });

  it("hides welcome after dismiss", () => {
    saveTourState({ welcomeSeen: true, dismissed: true, completed: false });
    expect(shouldShowWelcome(loadTourState())).toBe(false);
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBeTruthy();
  });
});
