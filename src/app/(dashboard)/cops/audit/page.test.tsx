import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { copsFetchMock, CopsRequestErrorMock } = vi.hoisted(() => {
  class MockCopsRequestError extends Error {
    constructor(
      message: string,
      public envelope: unknown,
      public cause: unknown
    ) {
      super(message);
    }
  }
  return { copsFetchMock: vi.fn(), CopsRequestErrorMock: MockCopsRequestError };
});

vi.mock("@/lib/api-client", () => ({
  isRetryableAuthError: () => false,
  useApiFetch: () => vi.fn(),
  useAuthReady: () => true,
}));

vi.mock("@/lib/cops-fetch", () => ({
  CopsRequestError: CopsRequestErrorMock,
  copsFetch: copsFetchMock,
}));

import CopsAuditPage from "./page";

describe("CopsAuditPage validation errors", () => {
  afterEach(() => {
    cleanup();
    copsFetchMock.mockReset();
  });

  it("shows the API's 422 date field error after submitting the filter form", async () => {
    copsFetchMock.mockImplementation((path: string) => {
      if (path.includes("from=")) {
        return Promise.reject(
          new CopsRequestErrorMock(
            "Invalid query",
            {
              code: "VALIDATION_FAILED",
              message: "Invalid query",
              details: { fields: [{ path: "from", code: "invalid_date", message: "Invalid datetime" }] },
              request_id: "request-1",
              retryable: false,
            },
            null
          )
        );
      }
      return Promise.resolve({ data: [], next_cursor: null });
    });

    render(<CopsAuditPage />);
    await waitFor(() => expect(copsFetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-06" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("From date: Invalid datetime")).toBeTruthy();
  });
});
