'use client';

// Canvas do Studio: React Flow com grade de encaixe, minimapa, ligações ortogonais
// e checagem de compatibilidade das ligações no motor.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType, applyEdgeChanges, applyNodeChanges, useReactFlow,
  type Connection, type Edge, type EdgeChange, type NodeChange, type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NODE_CATEGORIES, type JourneyGraph } from '@cortex/schemas';
import { isConnectionAllowed } from '@cortex/engine';
import { StudioNode, NODE_H, NODE_W, type StudioFlowNode, type StudioNodeData, type StudioNodeDeco } from './StudioNode';
import { DND_MIME } from './Palette';

const nodeTypes = { cortex: StudioNode };

export interface CanvasProps {
  graph: JourneyGraph;
  decorate: (nodeId: string) => StudioNodeDeco;
  activeEdgeIds: Set<string>;
  editable: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onMoveNodes: (positions: Record<string, { x: number; y: number }>) => void;
  onConnect: (c: Connection) => void;
  onDelete: (nodeIds: string[], edgeIds: string[]) => void;
  onDropKind: (kind: string, position: { x: number; y: number }) => void;
  fitKey: string;
  children?: ReactNode;
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function Canvas(props: CanvasProps) {
  const { graph, decorate, activeEdgeIds, editable, selectedIds, onSelect, onMoveNodes, onConnect, onDelete, onDropKind, fitKey, children } = props;
  const rf = useReactFlow();
  const [nodes, setNodes] = useState<StudioFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;

  // Sincroniza o estado do React Flow com o grafo (preservando medidas já calculadas).
  useEffect(() => {
    const sel = new Set(selectedIds);
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return graph.nodes.map((n) => {
        const d = decorate(n.id);
        const old = prevById.get(n.id);
        const problems = d.problems.length ? `, ${d.problems.length} problema(s)` : '';
        return {
          ...(old ?? {}),
          id: n.id,
          type: 'cortex' as const,
          position: old?.dragging ? old.position : n.position,
          width: NODE_W,
          height: NODE_H,
          selected: sel.has(n.id),
          draggable: editable,
          connectable: editable,
          deletable: editable,
          ariaLabel: `${n.label} (${NODE_CATEGORIES[n.category].label})${problems}`,
          data: { node: n, ...d },
        };
      });
    });
  }, [graph, decorate, selectedIds, editable]);

  useEffect(() => {
    setEdges((prev) => {
      const selPrev = new Set(prev.filter((e) => e.selected).map((e) => e.id));
      return graph.edges.map((e) => {
        const active = activeEdgeIds.has(e.id);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          type: 'smoothstep',
          label: e.label ?? e.sourceHandle,
          selected: selPrev.has(e.id),
          deletable: editable,
          className: active ? 'edge-active' : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: active ? '#00FF95' : '#5B4585' },
          labelStyle: { fill: '#A99FB8', fontSize: 10 },
          labelBgStyle: { fill: '#1A0D33' },
          labelBgPadding: [4, 2] as [number, number],
        };
      });
    });
  }, [graph, activeEdgeIds, editable]);

  // Enquadra ao abrir outra jornada/versão.
  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.2, duration: 200 }), 60);
    return () => clearTimeout(t);
  }, [fitKey, rf]);

  const isValidConnection: IsValidConnection = useMemo(
    () => (c) => editable && isConnectionAllowed(graph, c.source, c.target, c.sourceHandle ?? undefined).allowed,
    [graph, editable],
  );

  const handleNodesChange = (changes: NodeChange<StudioFlowNode>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    const moved: Record<string, { x: number; y: number }> = {};
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.dragging) moved[c.id] = { x: Math.round(c.position.x), y: Math.round(c.position.y) };
    }
    if (Object.keys(moved).length) onMoveNodes(moved);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds));

  return (
    <div
      className="relative h-full w-full"
      onDragOver={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        if (!editable) return;
        const kind = e.dataTransfer.getData(DND_MIME);
        if (!kind) return;
        e.preventDefault();
        const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onDropKind(kind, { x: Math.round((p.x - NODE_W / 2) / 20) * 20, y: Math.round((p.y - NODE_H / 2) / 20) * 20 });
      }}
    >
      <ReactFlow<StudioFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDelete={({ nodes: ns, edges: es }) => onDelete(ns.map((n) => n.id), es.map((e) => e.id))}
        onSelectionChange={({ nodes: ns }) => {
          const ids = ns.map((n) => n.id);
          if (!sameIds(ids, selectedRef.current)) onSelect(ids);
        }}
        deleteKeyCode={editable ? ['Delete', 'Backspace'] : null}
        nodesDraggable={editable}
        nodesConnectable={editable}
        nodesFocusable
        edgesFocusable
        snapToGrid
        snapGrid={[20, 20]}
        connectionLineStyle={{ stroke: '#00FF95', strokeWidth: 1.5 }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#3A2560" gap={20} size={1} />
        <MiniMap
          pannable
          zoomable
          className="!bottom-2 !right-2 !m-0 rounded-field border border-border"
          nodeColor={(n) => NODE_CATEGORIES[(n.data as StudioNodeData).node.category].color}
          maskColor="rgba(13,0,32,0.7)"
          style={{ width: 150, height: 96 }}
          ariaLabel="Minimapa do fluxo"
        />
        <Controls showInteractive={false} className="!bottom-2 !left-2 !m-0" />
      </ReactFlow>
      {children}
    </div>
  );
}
