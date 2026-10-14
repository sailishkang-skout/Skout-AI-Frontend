// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = { contractFields: vi.fn(), setContractFields: vi.fn() };
vi.mock("@/lib/api-client", () => ({ useAuthReady: () => true, useApiFetch: () => vi.fn() }));
vi.mock("@/lib/cops-commercial-advanced", async (original) => ({ ...(await original<typeof import("@/lib/cops-commercial-advanced")>()), useCopsAdvancedApi: () => api }));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

import { ContractFieldsCard } from "./contract-fields-card";

const wrap = (permissions: string[]) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ContractFieldsCard accountId="acc1" permissions={permissions} />
    </QueryClientProvider>
  );

beforeEach(() => {
  api.contractFields.mockReset().mockResolvedValue({ data: { region: "EU" } });
  api.setContractFields.mockReset().mockResolvedValue({ data: { region: "EU", segment: "enterprise" } });
});
afterEach(cleanup);

describe("ContractFieldsCard", () => {
  it("shows the account's fields and saves a change, sending every field so an emptied one is cleared", async () => {
    wrap(["commercial:read", "commercial:write"]);
    expect(((await screen.findByLabelText("Region")) as HTMLInputElement).value).toBe("EU");
    const save = screen.getByRole("button", { name: "Save contract details" }) as HTMLButtonElement;
    // Nothing changed yet.
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Segment"), { target: { value: "enterprise" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.setContractFields).toHaveBeenCalledWith("acc1", { region: "EU", segment: "enterprise", legal_entity: "" }));
  });

  it("is read-only without write access", async () => {
    wrap(["commercial:read"]);
    expect(((await screen.findByLabelText("Region")) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save contract details" })).toBeNull();
  });
});
