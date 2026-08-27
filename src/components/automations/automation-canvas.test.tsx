import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomationCanvas } from "./automation-canvas";
import type { AutomationGraph } from "@/lib/automations";

afterEach(cleanup);

function emptyGraph(): AutomationGraph {
  return { nodes: [], edges: [] };
}

function graphWithTrigger(): AutomationGraph {
  return {
    nodes: [{ id: "n1", type: "trigger", config: {}, position: { x: 0, y: 0 } }],
    edges: [],
  };
}

describe("AutomationCanvas", () => {
  it("renders existing nodes from the graph", () => {
    render(<AutomationCanvas graph={graphWithTrigger()} onChange={vi.fn()} />);
    expect(screen.getByText(/trigger · n1/)).toBeTruthy();
  });

  it("adds a node of the selected palette type and reports it via onChange", () => {
    const onChange = vi.fn();
    render(<AutomationCanvas graph={emptyGraph()} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("add-node-type"), { target: { value: "delay" } });
    fireEvent.click(screen.getByTestId("add-node-button"));

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AutomationGraph;
    expect(lastCall.nodes).toHaveLength(1);
    expect(lastCall.nodes[0].type).toBe("delay");
  });

  it("shows a placeholder when no node is selected", () => {
    render(<AutomationCanvas graph={graphWithTrigger()} onChange={vi.fn()} />);
    expect(screen.getByText(/select a node to edit/i)).toBeTruthy();
  });

  it("selecting a node shows its config panel and edits propagate through onChange", () => {
    const onChange = vi.fn();
    render(<AutomationCanvas graph={graphWithTrigger()} onChange={onChange} />);

    fireEvent.click(screen.getByText(/trigger · n1/));
    expect(screen.getByTestId("config-triggerType")).toBeTruthy();

    fireEvent.change(screen.getByTestId("config-triggerType"), { target: { value: "webhook" } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AutomationGraph;
    expect(lastCall.nodes[0].config).toEqual({ triggerType: "webhook" });
  });
});
