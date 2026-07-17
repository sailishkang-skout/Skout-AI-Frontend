import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadTourState,
  saveTourState,
  shouldShowWelcome,
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
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

  it("has four guided steps", () => {
    expect(TOUR_STEPS).toHaveLength(4);
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
