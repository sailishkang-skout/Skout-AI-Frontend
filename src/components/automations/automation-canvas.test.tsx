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

function makeDataTransfer() {
  const data: Record<string, string> = {};
  const types: string[] = [];
  return {
    setData: (key: string, value: string) => {
      data[key] = value;
      if (!types.includes(key)) types.push(key);
    },
    getData: (key: string) => data[key] ?? "",
    types,
    dropEffect: "",
    effectAllowed: "",
  };
}

describe("AutomationCanvas", () => {
  it("renders existing nodes from the graph", () => {
    render(<AutomationCanvas graph={graphWithTrigger()} onChange={vi.fn()} />);
    expect(screen.getByText(/trigger · n1/)).toBeTruthy();
  });

  it("clicking a palette block adds a node of that type and reports it via onChange", () => {
    const onChange = vi.fn();
    render(<AutomationCanvas graph={emptyGraph()} onChange={onChange} />);

    fireEvent.click(screen.getByTestId("palette-delay"));

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AutomationGraph;
    expect(lastCall.nodes).toHaveLength(1);
    expect(lastCall.nodes[0].type).toBe("delay");
  });

  it("dragging a palette block onto the canvas drops a node of that type", () => {
    const onChange = vi.fn();
    render(<AutomationCanvas graph={emptyGraph()} onChange={onChange} />);

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(screen.getByTestId("palette-action_http"), { dataTransfer });

    const dropzone = screen.getByTestId("automation-canvas-dropzone");
    fireEvent.dragOver(dropzone, { dataTransfer, clientX: 200, clientY: 150 });
    fireEvent.drop(dropzone, { dataTransfer, clientX: 200, clientY: 150 });

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AutomationGraph;
    expect(lastCall.nodes).toHaveLength(1);
    expect(lastCall.nodes[0].type).toBe("action_http");
  });

  it("does not open the config drawer until a node is selected", () => {
    render(<AutomationCanvas graph={graphWithTrigger()} onChange={vi.fn()} />);
    expect(screen.queryByTestId("config-triggerType")).toBeNull();
  });

  it("selecting a node opens the drawer and edits propagate through onChange", () => {
    const onChange = vi.fn();
    render(<AutomationCanvas graph={graphWithTrigger()} onChange={onChange} />);

    fireEvent.click(screen.getByText(/trigger · n1/));
    expect(screen.getByTestId("config-triggerType")).toBeTruthy();

    fireEvent.change(screen.getByTestId("config-triggerType"), { target: { value: "webhook" } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AutomationGraph;
    expect(lastCall.nodes[0].config).toEqual({ triggerType: "webhook" });
  });

  it("Done closes the drawer", () => {
    render(<AutomationCanvas graph={graphWithTrigger()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/trigger · n1/));
    expect(screen.getByTestId("config-triggerType")).toBeTruthy();

    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByTestId("config-triggerType")).toBeNull();
  });

  it("Auto-arrange lays out nodes left-to-right and reports the new positions", () => {
    const onChange = vi.fn();
    const graph: AutomationGraph = {
      nodes: [
        { id: "a", type: "trigger", config: {}, position: { x: 500, y: 500 } },
        { id: "b", type: "action_http", config: {}, position: { x: 10, y: 10 } },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    };
    render(<AutomationCanvas graph={graph} onChange={onChange} />);

    fireEvent.click(screen.getByText(/Auto-arrange/));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AutomationGraph;
    const a = lastCall.nodes.find((n) => n.id === "a")!;
    const b = lastCall.nodes.find((n) => n.id === "b")!;
    expect(a.position!.x).toBeLessThan(b.position!.x);
  });
});
