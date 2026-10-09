import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  versions: vi.fn(),
  save: vi.fn(),
  rollback: vi.fn(),
  modules: vi.fn(),
  retentionRuns: vi.fn(),
  retentionRun: vi.fn(),
  inventory: vi.fn(),
  metrics: vi.fn(),
  activationTemplates: vi.fn(),
  newActivationVersion: vi.fn(),
}));
vi.mock("@/lib/cops-admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cops-admin")>()),
  useCopsAdminApi: () => api,
}));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  useAuthReady: () => true,
}));

import { CONFIG_FIELDS, formatMetric, formToValue, valueToForm } from "@/lib/cops-admin";
import { ConfigEditor } from "./config-editor";
import { ActivationPanel, FeatureFlagsPanel, OpsPanel, RetentionPanel } from "./admin-panels";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const trial = { kind: "trial_template", key: "standard", version: 2, value: { name: "Standard trial", plan: "trial", trial_days: 14, credits: 500, integrations: ["crm", "email"] }, reason: "x", restored_from_version: null, created_by: null, created_at: "2026-10-09T00:00:00Z", is_system_default: false };
const editor = (canWrite = true) => <ConfigEditor kind="trial_template" title="Trial templates" canWrite={canWrite} keyHint="k" emptyTitle="No trial templates yet" emptyHint="Add one" />;

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(() => cleanup());

describe("COPS-07 admin helpers", () => {
  it("converts form strings to the typed value and back", () => {
    const fields = CONFIG_FIELDS.trial_template;
    const form = valueToForm(fields, trial.value);
    expect(form).toMatchObject({ trial_days: "14", integrations: "crm, email" });
    expect(formToValue(fields, { ...form, trial_days: "21", integrations: "crm , calendar" })).toEqual({ name: "Standard trial", plan: "trial", trial_days: 21, credits: 500, integrations: ["crm", "calendar"] });
  });

  it("formats metrics for people", () => {
    expect(formatMetric({ value: null, unit: "ms" })).toBe("No data");
    expect(formatMetric({ value: 5900, unit: "ms" })).toBe("5.9 s");
    expect(formatMetric({ value: 600, unit: "seconds" })).toBe("10 min");
    expect(formatMetric({ value: 97, unit: "percent" })).toBe("97%");
  });
});

describe("ConfigEditor", () => {
  it("saving needs a reason and sends the loaded version so a stale edit is refused", async () => {
    api.list.mockResolvedValue({ data: [trial] });
    api.save.mockResolvedValue({ data: { ...trial, version: 3 } });
    wrap(editor());
    fireEvent.click(await screen.findByTestId("config-edit-standard"));
    expect(screen.getByTestId("config-form").textContent).toContain("saves as v3");
    fireEvent.change(screen.getByLabelText("Trial length (days)"), { target: { value: "21" } });
    const save = screen.getByTestId("config-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for this change"), { target: { value: "Longer trials" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
    expect(api.save.mock.calls[0]).toEqual(["trial_template", "standard", { name: "Standard trial", plan: "trial", trial_days: 21, credits: 500, integrations: ["crm", "email"] }, "Longer trials", 2]);
  });

  it("shows the empty state, and a reader sees no edit controls", async () => {
    api.list.mockResolvedValue({ data: [] });
    wrap(editor(false));
    expect((await screen.findByTestId("config-empty-trial_template")).textContent).toContain("No trial templates yet");
    expect(screen.queryByTestId("config-new-trial_template")).toBeNull();
  });

  it("the built-in default is labelled and has no history", async () => {
    api.list.mockResolvedValue({ data: [{ ...trial, version: 0, is_system_default: true }] });
    wrap(editor());
    const row = await screen.findByTestId("config-row-standard");
    expect(row.textContent).toContain("built-in default");
    expect(row.textContent).not.toContain("History");
  });
});

describe("RetentionPanel", () => {
  it("deleting is offered only after a dry run that found rows, and needs a reason", async () => {
    api.list.mockResolvedValue({ data: [{ ...trial, kind: "retention_policy", key: "default", value: { categories: { diagnostics: { days: 30 } } } }] });
    api.retentionRuns.mockResolvedValue({ data: [], targets: [{ table: "cops_outbox", category: "diagnostics" }, { table: "audit_logs", category: "audit_logs" }] });
    api.inventory.mockResolvedValue({ data: [{ table: "contacts", category: "core_records", tags: ["personal_data"], retention: "dsar_only" }] });
    api.retentionRun.mockResolvedValueOnce({ data: { id: "d1", mode: "dry_run", policy_version: 1, counts: {}, total_rows: 12, dry_run_id: null, reason: null, created_at: "2026-10-09T00:00:00Z" } }).mockResolvedValue({ data: { id: "a1", mode: "apply", total_rows: 12 } });
    wrap(<RetentionPanel canWrite />);
    await screen.findByTestId("admin-inventory");
    expect(screen.queryByTestId("retention-apply")).toBeNull();
    // Categories with no automatic target cannot be given a period.
    expect(((await screen.findByLabelText("core records days")) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("diagnostics days") as HTMLInputElement).value).toBe("30");
    fireEvent.click(screen.getByTestId("retention-dry-run"));
    expect((await screen.findByTestId("retention-dry-result")).textContent).toContain("12 rows");
    const apply = screen.getByTestId("retention-apply") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.change(screen.getAllByLabelText("Reason")[0]!, { target: { value: "Quarterly cleanup" } });
    fireEvent.click(apply);
    await waitFor(() => expect(api.retentionRun).toHaveBeenLastCalledWith({ mode: "apply", dry_run_id: "d1", reason: "Quarterly cleanup" }));
  });
});

describe("ActivationPanel", () => {
  it("a new version is edited as milestones, and cannot be saved until the weights add up to 100", async () => {
    const milestones = [
      { key: "first_search", label: "First search", weight: 60, required: true, source: "event", event_types: ["product.search"] },
      { key: "first_export", label: "First export", weight: 40, required: true, source: "event", event_types: ["product.export"] },
    ];
    api.activationTemplates.mockResolvedValue({ data: [{ id: "a1", key: "default_trial", version: 1, segment: null, milestones, is_system_default: true, created_at: "2026-10-08T00:00:00Z" }] });
    api.newActivationVersion.mockResolvedValue({ data: {} });
    wrap(<ActivationPanel canWrite />);
    fireEvent.click(await screen.findByText("New version from this"));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Search matters more" } });
    fireEvent.change(screen.getByLabelText("Milestone 1 weight"), { target: { value: "70" } });
    expect(screen.getByTestId("activation-total").textContent).toContain("110%");
    const save = screen.getByTestId("activation-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Milestone 2 weight"), { target: { value: "30" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(api.newActivationVersion).toHaveBeenCalledOnce());
    const [key, body] = api.newActivationVersion.mock.calls[0]!;
    expect(key).toBe("default_trial");
    expect(body).toMatchObject({ segment: null, reason: "Search matters more" });
    expect(body.milestones.map((m: { weight: number }) => m.weight)).toEqual([70, 30]);
    // Event types of an existing milestone are kept.
    expect(body.milestones[0].event_types).toEqual(["product.search"]);
  });
});

describe("FeatureFlagsPanel and OpsPanel", () => {
  it("a module change is saved with a reason", async () => {
    api.modules.mockResolvedValue({ data: { crm: true, commercial: true, provisioning: true, onboarding: true, tickets: true, admin: true } });
    api.save.mockResolvedValue({ data: {} });
    wrap(<FeatureFlagsPanel canWrite />);
    fireEvent.click(await screen.findByLabelText("tickets module"));
    const save = screen.getByTestId("flags-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Pause tickets" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
    expect(api.save.mock.calls[0]).toEqual(["feature_flags", "default", { modules: { crm: true, commercial: true, provisioning: true, onboarding: true, tickets: false } }, "Pause tickets"]);
  });

  it("a metric over its threshold shows its status and runbook", async () => {
    api.metrics.mockResolvedValue({ data: { generated_at: "", metrics: [
      { key: "outbox_lag_seconds", label: "Outbox lag", value: 900, unit: "seconds", warn_at: 60, critical_at: 300, status: "critical", runbook: "docs/runbooks/cops-platform.md" },
      { key: "outbox_pending", label: "Events waiting", value: 0, unit: "count", warn_at: 500, critical_at: 5000, status: "ok", runbook: "docs/runbooks/cops-platform.md" },
    ] } });
    wrap(<OpsPanel />);
    const lag = await screen.findByTestId("metric-outbox_lag_seconds");
    expect(lag.textContent).toContain("Critical");
    expect(lag.textContent).toContain("15 min");
    expect(lag.textContent).toContain("cops-platform.md");
    expect(screen.getByTestId("metric-outbox_pending").textContent).not.toContain("Runbook");
  });
});
