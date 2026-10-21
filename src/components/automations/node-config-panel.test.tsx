import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeConfigPanel } from "./node-config-panel";
import type { AutomationNode } from "@/lib/automations";

// This project doesn't set vitest `globals: true`, so RTL's implicit afterEach-cleanup
// registration never fires — without this, two tests rendering the same node type (both
// action_http tests use "config-body") collide on data-testid across un-unmounted renders.
afterEach(cleanup);

function node(type: AutomationNode["type"], config: Record<string, unknown> = {}): AutomationNode {
  return { id: "n1", type, config };
}

describe("NodeConfigPanel", () => {
  it("renders delay's seconds field and reports numeric changes merged into config", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("delay", { seconds: 5 })} onChange={onChange} />);
    const input = screen.getByTestId("config-seconds") as HTMLInputElement;
    expect(input.value).toBe("5");
    fireEvent.change(input, { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith({ seconds: 30 });
  });

  it("opens an older single-rule condition as a one-rule group and saves the group", () => {
    const onChange = vi.fn();
    render(
      <NodeConfigPanel
        node={node("condition", { sourceNodeId: "n0", field: "status", op: "equals", value: "active" })}
        onChange={onChange}
        priorNodes={[{ id: "n0", label: "trigger · n0" }]}
      />
    );
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "paused" } });
    expect(onChange).toHaveBeenCalledWith({
      match: "all",
      rules: [{ sourceNodeId: "n0", field: "status", op: "equals", value: "paused", type: "string" }],
    });
  });

  it("a rule's step dropdown lists priorNodes and reports the selected id", () => {
    const onChange = vi.fn();
    render(
      <NodeConfigPanel
        node={node("condition", {})}
        onChange={onChange}
        priorNodes={[
          { id: "n1", label: "action_http · n1" },
          { id: "n0", label: "trigger · n0" },
        ]}
      />
    );
    const select = screen.getByLabelText("Step") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(expect.arrayContaining(["n1", "n0"]));
    fireEvent.change(select, { target: { value: "n1" } });
    expect(onChange.mock.calls.at(-1)![0].rules[0]).toMatchObject({ sourceNodeId: "n1" });
  });

  it("shows a saved step as '(not connected)' when it's no longer an ancestor", () => {
    render(<NodeConfigPanel node={node("condition", { sourceNodeId: "n9" })} onChange={vi.fn()} priorNodes={[]} />);
    expect((screen.getByLabelText("Step") as HTMLSelectElement).value).toBe("n9");
    expect(screen.getByText(/n9 \(not connected\)/)).toBeTruthy();
  });

  it("switches a group to OR, and a number rule offers ordering operators", () => {
    const onChange = vi.fn();
    const config = { match: "all", rules: [{ sourceNodeId: "n0", field: "seats", op: "gte", value: "100", type: "number" }] };
    render(<NodeConfigPanel node={node("condition", config)} onChange={onChange} priorNodes={[{ id: "n0", label: "trigger · n0" }]} />);
    const ops = Array.from((screen.getByLabelText("Operator") as HTMLSelectElement).options).map((o) => o.value);
    expect(ops).toEqual(expect.arrayContaining(["gt", "gte", "lt", "lte"]));
    expect(ops).not.toContain("contains");
    fireEvent.change(screen.getByLabelText("Match all or any"), { target: { value: "any" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ match: "any" }));
  });

  it("the trigger selector sets an event trigger and its stop events", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("trigger", {})} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("config-trigger-kind"), { target: { value: "event" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "event", eventType: "TicketCreated" }));
    fireEvent.click(screen.getByRole("button", { name: "Customer activated" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stopOn: ["CustomerActivated"] }));
  });

  it("renders action_http's url/method/body fields", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_http", { url: "https://example.com", method: "POST" })} onChange={onChange} />);
    expect((screen.getByTestId("config-url") as HTMLInputElement).value).toBe("https://example.com");
    fireEvent.change(screen.getByTestId("config-method"), { target: { value: "PATCH" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ method: "PATCH" }));
  });

  it("lists prior nodes by their real (full) id, not the short canvas label", () => {
    // A node labeled "action_http · 6407" on the canvas is really "n1787869206593" — "6407" is
    // just the last 4 characters shown for compactness. Typing the short suffix into a template
    // token silently resolves to nothing, so the panel has to show the actual id to copy.
    render(
      <NodeConfigPanel
        node={node("action_http", {})}
        onChange={vi.fn()}
        priorNodes={[{ id: "n1787869206593", label: "trigger · 6593" }]}
      />
    );
    expect(screen.getByText("n1787869206593")).toBeTruthy();
  });

  it("shows a no-earlier-steps message when nothing is connected upstream", () => {
    render(<NodeConfigPanel node={node("action_http", {})} onChange={vi.fn()} priorNodes={[]} />);
    expect(screen.getByText(/No earlier steps connected yet/)).toBeTruthy();
  });

  it("parses JSON typed into the HTTP body field", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_http", {})} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("config-body"), { target: { value: '{"a":1}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ body: { a: 1 } }));
  });

  it("renders approval's entity fields", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("approval", { entityType: "automation_run", entityId: "run-1" })} onChange={onChange} />);
    expect((screen.getByTestId("config-approval-entityId") as HTMLInputElement).value).toBe("run-1");
  });

  it("renders sequence-enroll's two fields", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_sequence_enroll", { sequenceId: "seq-1" })} onChange={onChange} />);
    expect((screen.getByTestId("config-sequenceId") as HTMLInputElement).value).toBe("seq-1");
    fireEvent.change(screen.getByTestId("config-prospectId"), { target: { value: "p-1" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ prospectId: "p-1" }));
  });

  it("renders crm-writeback's fields", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_crm_writeback", { entityType: "contact" })} onChange={onChange} />);
    expect((screen.getByTestId("config-entityType") as HTMLSelectElement).value).toBe("contact");
  });

  it("renders notification's fields", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_notification", { title: "Hi" })} onChange={onChange} />);
    expect((screen.getByTestId("config-title") as HTMLInputElement).value).toBe("Hi");
  });

  it("renders trigger's type selector defaulting to manual", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("trigger", {})} onChange={onChange} />);
    expect((screen.getByTestId("config-triggerType") as HTMLSelectElement).value).toBe("manual");
  });

  // §8.14 SP-15 — field names below must exactly match what each backend node handler
  // destructures from config (apps/api/src/services/automation-nodes/*.node.ts), per this
  // file's own top-of-component comment. A mismatch here is a silent undefined at run time,
  // not a compile error, so each field name is asserted explicitly rather than just "renders".
  it("renders action_ai's prospectId/prompt fields, matching action-ai.node.ts's { prospectId, prompt }", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_ai", { prospectId: "p-1", prompt: "Draft a follow-up" })} onChange={onChange} />);
    expect((screen.getByTestId("config-ai-prospectId") as HTMLInputElement).value).toBe("p-1");
    fireEvent.change(screen.getByTestId("config-ai-prompt"), { target: { value: "New prompt" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ prospectId: "p-1", prompt: "New prompt" }));
  });

  it("renders action_enrichment's companyDomain field and the field-toggle chips, matching action-enrichment.node.ts's { companyDomain, fields }", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_enrichment", { companyDomain: "acme.com", fields: ["company"] })} onChange={onChange} />);
    expect((screen.getByTestId("config-companyDomain") as HTMLInputElement).value).toBe("acme.com");
    fireEvent.click(screen.getByTestId("config-enrich-field-email"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fields: ["company", "email"] }));
  });

  it("toggling an already-selected enrichment field removes it instead of duplicating", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_enrichment", { fields: ["company", "email"] })} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("config-enrich-field-email"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fields: ["company"] }));
  });

  it("renders action_crm_sync's entityType/entityId/patch fields, matching action-crm-sync.node.ts's { entityType, entityId, patch } — contact/deal only, not company", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_crm_sync", { entityType: "deal", entityId: "d-1" })} onChange={onChange} />);
    const select = screen.getByTestId("config-sync-entityType") as HTMLSelectElement;
    expect(select.value).toBe("deal");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["contact", "deal"]);
    fireEvent.change(screen.getByTestId("config-sync-entityId"), { target: { value: "d-2" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ entityId: "d-2" }));
  });

  it("parses JSON typed into the CRM push-back patch field", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_crm_sync", {})} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("config-patch"), { target: { value: '{"firstName":"Ada"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ patch: { firstName: "Ada" } }));
  });
});
