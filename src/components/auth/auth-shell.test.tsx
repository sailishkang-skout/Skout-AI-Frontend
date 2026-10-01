// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// The WebGL effects are not testable in jsdom; the shell must still render its frame and children.
vi.mock("@/components/auth/electric-logo/ElectricLogo", () => ({
  default: () => <div data-testid="electric-logo" />,
}));
vi.mock("@/components/auth/pulses-background", () => ({
  PulsesBackground: () => <div data-testid="pulses" />,
}));

import { AuthShell } from "./auth-shell";

describe("AuthShell", () => {
  afterEach(cleanup);

  it("renders the Skout logo, the background effects and the page content", () => {
    render(
      <AuthShell>
        <p>form goes here</p>
      </AuthShell>,
    );
    expect(screen.getByAltText("Skout")).toBeTruthy();
    expect(screen.getByTestId("pulses")).toBeTruthy();
    expect(screen.getByTestId("electric-logo")).toBeTruthy();
    expect(screen.getByText("form goes here")).toBeTruthy();
  });
});
