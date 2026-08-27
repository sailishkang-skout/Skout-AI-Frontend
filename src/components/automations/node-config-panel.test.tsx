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

  it("renders condition's four fields and merges a change without dropping the others", () => {
    const onChange = vi.fn();
    render(
      <NodeConfigPanel
        node={node("condition", { sourceNodeId: "n0", field: "status", op: "equals", value: "active" })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByTestId("config-value"), { target: { value: "paused" } });
    expect(onChange).toHaveBeenCalledWith({ sourceNodeId: "n0", field: "status", op: "equals", value: "paused" });
  });

  it("renders action_http's url/method/body fields", () => {
    const onChange = vi.fn();
    render(<NodeConfigPanel node={node("action_http", { url: "https://example.com", method: "POST" })} onChange={onChange} />);
    expect((screen.getByTestId("config-url") as HTMLInputElement).value).toBe("https://example.com");
    fireEvent.change(screen.getByTestId("config-method"), { target: { value: "PATCH" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ method: "PATCH" }));
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
});
