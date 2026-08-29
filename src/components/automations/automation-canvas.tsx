"use client";

import type { DragEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnEdgesDelete,
  type OnNodesDelete,
} from "reactflow";
import "reactflow/dist/style.css";
import { Bell, Clock, Database, GitBranch, Globe, LayoutGrid, ShieldCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AutomationEdge, AutomationGraph, AutomationNode, AutomationNodeType } from "@/lib/automations";
import { ALL_NODE_TYPES, NodeConfigPanel } from "./node-config-panel";

const DRAG_MIME = "application/x-automation-node-type";

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

const NODE_ICONS: Record<AutomationNodeType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  trigger: Zap,
  condition: GitBranch,
  delay: Clock,
  action_http: Globe,
  action_notification: Bell,
  action_crm_writeback: Database,
  action_sequence_enroll: Users,
  approval: ShieldCheck,
};

interface FlowNodeData {
  nodeType: AutomationNodeType;
  label: string;
}

const HANDLE_CLASS = "!h-2.5 !w-2.5 !border-2 !border-white dark:!border-slate-900";

/** Registered once at module scope — reactflow warns (and re-mounts nodes) if this is recreated every render. */
function AutomationFlowNode({ data, selected }: NodeProps<FlowNodeData>) {
  const Icon = NODE_ICONS[data.nodeType];
  return (
    <div
      className={cn(
        "flex min-w-[170px] items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-xs font-medium text-white shadow-md",
        selected ? "border-white" : "border-transparent"
      )}
      style={{ background: NODE_COLORS[data.nodeType] }}
    >
      {data.nodeType !== "trigger" && (
        <Handle type="target" position={Position.Left} className={cn(HANDLE_CLASS, "!bg-slate-700")} />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{data.label}</span>
      {data.nodeType === "condition" ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "35%" }} className={cn(HANDLE_CLASS, "!bg-emerald-400")} />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "70%" }} className={cn(HANDLE_CLASS, "!bg-rose-400")} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className={cn(HANDLE_CLASS, "!bg-slate-700")} />
      )}
    </div>
  );
}

const FLOW_NODE_TYPES = { automationNode: AutomationFlowNode };

const EDGE_DEFAULTS = {
  type: "smoothstep",
  animated: true,
  style: { strokeDasharray: "6 4" },
  markerEnd: { type: MarkerType.ArrowClosed },
} satisfies Partial<Edge>;

function nodeLabel(type: AutomationNodeType, id: string): string {
  return `${type} · ${id.slice(-4)}`;
}

function toFlowNode(node: AutomationNode, index: number): Node<FlowNodeData> {
  return {
    id: node.id,
    type: "automationNode",
    position: node.position ?? { x: 80 + index * 260, y: 80 },
    data: { nodeType: node.type, label: nodeLabel(node.type, node.id) },
  };
}

/** Every node with a path to `targetId`, nearest first — the "prior nodes" a condition can read. */
export function getAncestorIds(targetId: string, edges: Edge[]): string[] {
  const visited = new Set<string>();
  const queue = [targetId];
  const result: string[] = [];
  let i = 0;
  while (i < queue.length) {
    const id = queue[i++]!;
    for (const edge of edges) {
      if (edge.target === id && !visited.has(edge.source)) {
        visited.add(edge.source);
        result.push(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return result;
}

function toFlowEdge(edge: AutomationEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.branch,
    label: edge.branch,
    ...EDGE_DEFAULTS,
  };
}

/** Layers nodes left-to-right by BFS depth from nodes with no incoming edge — the "Auto-arrange" action. */
function layoutHorizontally(nodes: Node[], edges: Edge[]): Node[] {
  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  edges.forEach((e) => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));

  const layer = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((n) => {
    if ((incoming.get(n.id) ?? 0) === 0) {
      layer.set(n.id, 0);
      queue.push(n.id);
    }
  });

  const adjacency = new Map<string, string[]>();
  edges.forEach((e) => adjacency.set(e.source, [...(adjacency.get(e.source) ?? []), e.target]));

  let i = 0;
  while (i < queue.length) {
    const id = queue[i++];
    const depth = layer.get(id) ?? 0;
    for (const next of adjacency.get(id) ?? []) {
      if ((layer.get(next) ?? -1) < depth + 1) {
        layer.set(next, depth + 1);
        queue.push(next);
      }
    }
  }

  const countPerLayer = new Map<number, number>();
  return nodes.map((n) => {
    const l = layer.get(n.id) ?? 0;
    const idx = countPerLayer.get(l) ?? 0;
    countPerLayer.set(l, idx + 1);
    return { ...n, position: { x: 80 + l * 260, y: 80 + idx * 140 } };
  });
}

export interface AutomationCanvasProps {
  graph: AutomationGraph;
  onChange: (graph: AutomationGraph) => void;
}

/**
 * Visual block editor for §8.14. Node config field shapes must match what each backend node
 * handler destructures — see node-config-panel.tsx's own comment for the exact contract.
 */
export function AutomationCanvas(props: AutomationCanvasProps) {
  return (
    <ReactFlowProvider>
      <AutomationCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function AutomationCanvasInner({ graph, onChange }: AutomationCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<FlowNodeData>(graph.nodes.map(toFlowNode));
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(graph.edges.map(toFlowEdge));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<"node" | "edge" | null>(null);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(graph.nodes.map((n) => [n.id, n.config]))
  );
  const nodeTypeById = useRef<Record<string, AutomationNodeType>>(
    Object.fromEntries(graph.nodes.map((n) => [n.id, n.type]))
  );

  const emitChange = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], nextConfigs: Record<string, Record<string, unknown>>) => {
      onChange({
        nodes: nextNodes.map((n) => ({
          id: n.id,
          type: nodeTypeById.current[n.id] ?? "action_http",
          config: nextConfigs[n.id] ?? {},
          position: n.position,
        })),
        edges: nextEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          branch: (e.sourceHandle as "true" | "false" | undefined) ?? undefined,
        })),
      });
    },
    [onChange]
  );

  function closeDrawer() {
    setSelectedId(null);
    setSelectedKind(null);
  }

  function addNodeAt(type: AutomationNodeType, position?: { x: number; y: number }) {
    const id = `n${Date.now()}`;
    const count = rfNodes.length;
    const pos = position ?? { x: 80 + (count % 4) * 260, y: 80 + Math.floor(count / 4) * 140 };
    const newNode: Node<FlowNodeData> = {
      id,
      type: "automationNode",
      position: pos,
      data: { nodeType: type, label: nodeLabel(type, id) },
    };
    nodeTypeById.current[id] = type;
    const nextConfigs = { ...nodeConfigs, [id]: {} };
    const nextNodes = [...rfNodes, newNode];
    setRfNodes(nextNodes);
    setNodeConfigs(nextConfigs);
    emitChange(nextNodes, rfEdges, nextConfigs);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    const type = e.dataTransfer.getData(DRAG_MIME) as AutomationNodeType | "";
    if (!type) return;
    e.preventDefault();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNodeAt(type, position);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextEdges = addEdge(
        { ...connection, id: `e${Date.now()}`, ...EDGE_DEFAULTS, label: connection.sourceHandle ?? undefined },
        rfEdges
      );
      setRfEdges(nextEdges);

      // Connecting a node into a condition is how you tell it what to evaluate — auto-fill
      // sourceNodeId from the connection instead of making the user retype an id they just drew.
      // Only when it's not already set, so re-wiring a second input doesn't clobber a deliberate choice.
      let nextConfigs = nodeConfigs;
      const targetId = connection.target;
      if (targetId && connection.source && nodeTypeById.current[targetId] === "condition") {
        const currentConfig = nodeConfigs[targetId] ?? {};
        if (!currentConfig.sourceNodeId) {
          nextConfigs = { ...nodeConfigs, [targetId]: { ...currentConfig, sourceNodeId: connection.source } };
          setNodeConfigs(nextConfigs);
        }
      }

      emitChange(rfNodes, nextEdges, nextConfigs);
    },
    [rfEdges, rfNodes, nodeConfigs, setRfEdges, emitChange]
  );

  const handleNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      const deletedIds = new Set(deleted.map((n) => n.id));
      const nextNodes = rfNodes.filter((n) => !deletedIds.has(n.id));
      const nextEdges = rfEdges.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target));
      deletedIds.forEach((id) => delete nodeTypeById.current[id]);
      const nextConfigs = { ...nodeConfigs };
      deletedIds.forEach((id) => delete nextConfigs[id]);
      setRfEdges(nextEdges);
      setNodeConfigs(nextConfigs);
      if (selectedId && deletedIds.has(selectedId)) closeDrawer();
      emitChange(nextNodes, nextEdges, nextConfigs);
    },
    [rfNodes, rfEdges, nodeConfigs, selectedId, setRfEdges, emitChange]
  );

  const handleEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      const deletedIds = new Set(deleted.map((e) => e.id));
      const nextEdges = rfEdges.filter((e) => !deletedIds.has(e.id));
      if (selectedId && deletedIds.has(selectedId)) closeDrawer();
      setRfEdges(nextEdges);
      emitChange(rfNodes, nextEdges, nodeConfigs);
    },
    [rfNodes, rfEdges, nodeConfigs, selectedId, setRfEdges, emitChange]
  );

  function updateSelectedNodeConfig(config: Record<string, unknown>) {
    if (!selectedId) return;
    const nextConfigs = { ...nodeConfigs, [selectedId]: config };
    setNodeConfigs(nextConfigs);
    emitChange(rfNodes, rfEdges, nextConfigs);
  }

  function updateEdgeBranch(edgeId: string, branch: "true" | "false") {
    const nextEdges = rfEdges.map((e) => (e.id === edgeId ? { ...e, sourceHandle: branch, label: branch } : e));
    setRfEdges(nextEdges);
    emitChange(rfNodes, nextEdges, nodeConfigs);
  }

  function deleteEdge(edgeId: string) {
    const nextEdges = rfEdges.filter((e) => e.id !== edgeId);
    setRfEdges(nextEdges);
    closeDrawer();
    emitChange(rfNodes, nextEdges, nodeConfigs);
  }

  function autoArrange() {
    const laidOut = layoutHorizontally(rfNodes, rfEdges);
    setRfNodes(laidOut);
    emitChange(laidOut, rfEdges, nodeConfigs);
  }

  const selectedNode: AutomationNode | null = useMemo(() => {
    if (selectedKind !== "node" || !selectedId) return null;
    const type = nodeTypeById.current[selectedId];
    if (!type) return null;
    return { id: selectedId, type, config: nodeConfigs[selectedId] ?? {} };
  }, [selectedKind, selectedId, nodeConfigs]);

  const selectedEdge = useMemo(() => {
    if (selectedKind !== "edge" || !selectedId) return null;
    return rfEdges.find((e) => e.id === selectedId) ?? null;
  }, [selectedKind, selectedId, rfEdges]);

  const selectedEdgeFromCondition = selectedEdge ? nodeTypeById.current[selectedEdge.source] === "condition" : false;

  const priorNodesForSelected = useMemo(() => {
    if (!selectedNode) return [];
    return getAncestorIds(selectedNode.id, rfEdges).map((id) => ({
      id,
      label: nodeLabel(nodeTypeById.current[id] ?? "action_http", id),
    }));
  }, [selectedNode, rfEdges]);

  const drawerTitle = selectedNode
    ? ALL_NODE_TYPES.find((t) => t.type === selectedNode.type)?.label ?? selectedNode.type
    : "Connection";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Drag a block onto the canvas, or click to add it.</p>
        <Button variant="outline" size="sm" onClick={autoArrange}>
          <LayoutGrid className="h-4 w-4" />
          Auto-arrange
        </Button>
      </div>

      <div style={{ height: 560 }} className="flex flex-col overflow-hidden rounded-md border" data-testid="automation-canvas">
        <div className="flex-1" onDragOver={handleDragOver} onDrop={handleDrop} data-testid="automation-canvas-dropzone">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={FLOW_NODE_TYPES}
            defaultEdgeOptions={EDGE_DEFAULTS}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={handleNodesDelete}
            onEdgesDelete={handleEdgesDelete}
            onNodeClick={(_, n) => {
              setSelectedId(n.id);
              setSelectedKind("node");
            }}
            onEdgeClick={(_, e) => {
              setSelectedId(e.id);
              setSelectedKind("edge");
            }}
            onPaneClick={closeDrawer}
            proOptions={{ hideAttribution: true }}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/30 p-2">
          {ALL_NODE_TYPES.map((t) => {
            const Icon = NODE_ICONS[t.type];
            return (
              <button
                key={t.type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, t.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => addNodeAt(t.type)}
                className="flex cursor-grab items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium shadow-sm hover:border-primary/40 hover:bg-accent active:cursor-grabbing"
                data-testid={`palette-${t.type}`}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: NODE_COLORS[t.type] }} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <Sheet
        open={selectedKind !== null}
        onClose={closeDrawer}
        title={drawerTitle}
        description={selectedEdge ? "Connection between two nodes." : undefined}
      >
        {selectedNode && (
          <div className="space-y-4">
            <NodeConfigPanel node={selectedNode} onChange={updateSelectedNodeConfig} priorNodes={priorNodesForSelected} />
            <Button className="w-full" onClick={closeDrawer}>
              Done
            </Button>
          </div>
        )}

        {selectedEdge && (
          <div className="space-y-4">
            {selectedEdgeFromCondition && (
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Branch</span>
                <Select
                  data-testid="edge-branch"
                  value={(selectedEdge.sourceHandle as string) ?? "true"}
                  onChange={(e) => updateEdgeBranch(selectedEdge.id, e.target.value as "true" | "false")}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </Select>
              </label>
            )}
            <Button variant="destructive" className="w-full" onClick={() => deleteEdge(selectedEdge.id)}>
              Delete connection
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

