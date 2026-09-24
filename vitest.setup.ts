import { vi } from "vitest";

// jsdom has no ResizeObserver; reactflow's internal viewport/node sizing needs one to mount.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;