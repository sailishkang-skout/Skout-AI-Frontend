"use client";

import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesDelete,
  type OnNodesDelete,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { AutomationEdge, AutomationGraph, AutomationNode, AutomationNodeType } from "@/lib/automations";
import { ALL_NODE_TYPES, NodeConfigPanel } from "./node-config-panel";

const NODE_COLORS: Record<AutomationNodeType, string> = {
  trigger: "#7c3aed",
  condition: "#eab308",
  delay: "#64748b",
  action_http: "#0ea5e9",
  action_notification: "#22c55e",
  action_crm_writeback: "#f97316",
  action_sequence_enroll: "#ec4899",
  approval: "#ef4444",
};

function toFlowNode(node: AutomationNode, index: number): Node {
  return {
    id: node.id,
    position: node.position ?? { x: 80, y: 80 + index * 110 },
    data: { label: `${node.type} · ${node.id}` },
    style: {
      background: NODE_COLORS[node.type],
      color: "white",
      borderRadius: 8,
      padding: 8,
      fontSize: 12,
    },
  };
}

function toFlowEdge(edge: AutomationEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.branch,
    data: { branch: edge.branch },
  };
}

export interface AutomationCanvasProps {
  graph: AutomationGraph;
  onChange: (graph: AutomationGraph) => void;
}

/**
 * Visual block editor for §8.14. Node config field shapes must match what each backend node
 * handler destructures — see node-config-panel.tsx's own comment for the exact contract.
 */
export function AutomationCanvas({ graph, onChange }: AutomationCanvasProps) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(graph.nodes.map(toFlowNode));
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(graph.edges.map(toFlowEdge));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(graph.nodes.map((n) => [n.id, n.config]))
  );
  const [nodeTypes] = useState<Record<string, AutomationNodeType>>(() =>
    Object.fromEntries(graph.nodes.map((n) => [n.id, n.type]))
  );
  const [addType, setAddType] = useState<AutomationNodeType>("action_http");

  const emitChange = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], nextConfigs: Record<string, Record<string, unknown>>, nextTypes: Record<string, AutomationNodeType>) => {
      onChange({
        nodes: nextNodes.map((n) => ({
          id: n.id,
          type: nextTypes[n.id] ?? "action_http",
          config: nextConfigs[n.id] ?? {},
          position: n.position,
        })),
        edges: nextEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          branch: (e.data?.branch as "true" | "false" | undefined) ?? undefined,
        })),
      });
    },
    [onChange]
  );

  function addNode() {
    const id = `n${Date.now()}`;
    const newNode: Node = {
      id,
      position: { x: 80 + rfNodes.length * 40, y: 80 + rfNodes.length * 60 },
      data: { label: `${addType} · ${id}` },
      style: { background: NODE_COLORS[addType], color: "white", borderRadius: 8, padding: 8, fontSize: 12 },
    };
    const nextTypes = { ...nodeTypes, [id]: addType };
    const nextConfigs = { ...nodeConfigs, [id]: {} };
    const nextNodes = [...rfNodes, newNode];
    setRfNodes(nextNodes);
    setNodeConfigsState(nextConfigs);
    setNodeTypesState(nextTypes);
    emitChange(nextNodes, rfEdges, nextConfigs, nextTypes);
  }

  // nodeTypes is only set once at mount above (useState initializer) — these setters keep it
  // mutable across adds/deletes without re-deriving from props on every render.
  const [, setNodeTypesInternal] = useState(0);
  function setNodeTypesState(next: Record<string, AutomationNodeType>) {
    Object.assign(nodeTypes, next);
    setNodeTypesInternal((x) => x + 1);
  }
  function setNodeConfigsState(next: Record<string, Record<string, unknown>>) {
    setNodeConfigs(next);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceType = connection.source ? nodeTypes[connection.source] : undefined;
      const existingFromSource = rfEdges.filter((e) => e.source === connection.source);
      const branch = sourceType === "condition" ? (existingFromSource.length === 0 ? "true" : "false") : undefined;
      const nextEdges = addEdge({ ...connection, id: `e${Date.now()}`, label: branch, data: { branch } }, rfEdges);
      setRfEdges(nextEdges);
      emitChange(rfNodes, nextEdges, nodeConfigs, nodeTypes);
    },
    [rfEdges, rfNodes, nodeConfigs, nodeTypes, setRfEdges, emitChange]
  );

  const handleNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      const deletedIds = new Set(deleted.map((n) => n.id));
      const nextNodes = rfNodes.filter((n) => !deletedIds.has(n.id));
      const nextEdges = rfEdges.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target));
      setRfEdges(nextEdges);
      if (selectedId && deletedIds.has(selectedId)) setSelectedId(null);
      emitChange(nextNodes, nextEdges, nodeConfigs, nodeTypes);
    },
    [rfNodes, rfEdges, nodeConfigs, nodeTypes, selectedId, setRfEdges, emitChange]
  );

  const handleEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      const deletedIds = new Set(deleted.map((e) => e.id));
      const nextEdges = rfEdges.filter((e) => !deletedIds.has(e.id));
      emitChange(rfNodes, nextEdges, nodeConfigs, nodeTypes);
    },
    [rfNodes, rfEdges, nodeConfigs, nodeTypes, emitChange]
  );

  function updateSelectedNodeConfig(config: Record<string, unknown>) {
    if (!selectedId) return;
    const nextConfigs = { ...nodeConfigs, [selectedId]: config };
    setNodeConfigsState(nextConfigs);
    emitChange(rfNodes, rfEdges, nextConfigs, nodeTypes);
  }

  const selectedNode: AutomationNode | null = useMemo(() => {
    if (!selectedId || !nodeTypes[selectedId]) return null;
    return { id: selectedId, type: nodeTypes[selectedId]!, config: nodeConfigs[selectedId] ?? {} };
  }, [selectedId, nodeTypes, nodeConfigs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select data-testid="add-node-type" value={addType} onChange={(e) => setAddType(e.target.value as AutomationNodeType)}>
          {ALL_NODE_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </Select>
        <Button size="sm" data-testid="add-node-button" onClick={addNode}>
          Add node
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div style={{ height: 480 }} className="rounded-md border" data-testid="automation-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={handleNodesDelete}
            onEdgesDelete={handleEdgesDelete}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onEdgeClick={(_, e) => setSelectedId(e.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <div className="rounded-md border p-3">
          {selectedNode ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">{selectedNode.type}</p>
              <NodeConfigPanel node={selectedNode} onChange={updateSelectedNodeConfig} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a node to edit its configuration.</p>
          )}
        </div>
      </div>
    </div>
  );
}
