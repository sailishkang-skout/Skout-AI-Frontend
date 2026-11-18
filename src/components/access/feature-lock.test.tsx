import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureLock } from "./feature-lock";

function renderLock(features?: Record<string, boolean>) {
  const client = new QueryClient();
  if (features) client.setQueryData(["access"], { status: "active", features, request: null });
  return render(
    <QueryClientProvider client={client}>
      <FeatureLock feature="ai">
        <a href="/decisions">Priority decisions</a>
      </FeatureLock>
    </QueryClientProvider>
  );
}

describe("FeatureLock", () => {
  afterEach(() => cleanup());

  it("renders the section untouched when the feature is on", () => {
    renderLock({ ai: true });
    expect(screen.getByRole("link", { name: "Priority decisions" })).toBeTruthy();
    expect(screen.queryByText("Not on your plan")).toBeNull();
  });

  it("renders the section untouched while switches are unknown", () => {
    renderLock();
    expect(screen.queryByText("Not on your plan")).toBeNull();
  });

  it("blurs the section, hides it from assistive tech and blocks clicks when the feature is off", () => {
    renderLock({ ai: false });
    expect(screen.getByText("Not on your plan")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Priority decisions" })).toBeNull();
    const content = screen.getByTestId("feature-locked-ai").querySelector("[inert]");
    expect(content).not.toBeNull();
    expect(content!.className).toContain("blur");
  });
});
