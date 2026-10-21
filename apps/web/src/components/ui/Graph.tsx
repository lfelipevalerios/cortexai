'use client';

// Grafo de leitura com ligações ortogonais (linhagem, conhecimento, ecossistema,
// domínios). Mesma linguagem do slide 6: nós em círculo/cartão com halo.
import { useMemo } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cx } from '@/components/ui';

export type GraphTone = 'green' | 'purple' | 'lilac' | 'yellow' | 'red' | 'muted';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  tone?: GraphTone;
  /** Halo pulsante ("acendendo"). */
  glow?: boolean;
  /** Apagado (sem ligação, ex.: ilhas). */
  dim?: boolean;
  x?: number;
  y?: number;
  shape?: 'pill' | 'circle';
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

const TONE: Record<GraphTone, string> = {
  green: 'border-primary/60 text-primary',
  purple: 'border-accent/60 text-accent',
  lilac: 'border-accent-soft/50 text-accent-soft',
  yellow: 'border-warning/60 text-warning',
  red: 'border-danger/60 text-danger',
  muted: 'border-border text-text-muted',
};
const GLOW: Record<GraphTone, string> = {
  green: 'shadow-halo-green',
  purple: 'shadow-halo-purple',
  lilac: 'shadow-halo-purple',
  yellow: 'shadow-[0_0_18px_rgba(249,215,24,.35)]',
  red: 'shadow-halo-red',
  muted: '',
};

function GNode({ data }: NodeProps) {
  const d = data as unknown as GraphNode;
  const tone = d.tone ?? 'purple';
  return (
    <div
      className={cx(
        'border bg-surface-1 text-center transition-all duration-200',
        d.shape === 'circle' ? 'flex h-20 w-20 flex-col items-center justify-center rounded-full px-1' : 'min-w-[140px] max-w-[190px] rounded-card px-3 py-2',
        TONE[tone],
        d.glow && GLOW[tone],
        d.dim && 'opacity-40 grayscale',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
      <div className="truncate text-xs font-medium text-text">{d.label}</div>
      {d.sublabel && <div className="truncate text-[10px]">{d.sublabel}</div>}
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
    </div>
  );
}

const nodeTypes = { g: GNode };

/** Layout em camadas por profundidade (BFS) quando os nós não trazem posição. */
function autoLayout(nodes: GraphNode[], edges: GraphEdge[]) {
  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  edges.forEach((e) => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));
  const level = new Map<string, number>();
  const queue = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  queue.forEach((id) => level.set(id, 0));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const e of edges.filter((x) => x.source === id)) {
      if (!level.has(e.target)) {
        level.set(e.target, (level.get(id) ?? 0) + 1);
        queue.push(e.target);
      }
    }
  }
  nodes.forEach((n) => !level.has(n.id) && level.set(n.id, 0));
  const perLevel = new Map<number, number>();
  return nodes.map((n) => {
    const l = level.get(n.id)!;
    const row = perLevel.get(l) ?? 0;
    perLevel.set(l, row + 1);
    return { ...n, x: n.x ?? l * 230, y: n.y ?? row * 90 };
  });
}

export function Graph({ nodes, edges, height = 360, onNodeClick, className, fit = true }: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
  onNodeClick?: (id: string) => void;
  className?: string;
  fit?: boolean;
}) {
  const rf = useMemo(() => {
    const laid = nodes.some((n) => n.x === undefined) ? autoLayout(nodes, edges) : nodes;
    const n: Node[] = laid.map((g) => ({ id: g.id, type: 'g', position: { x: g.x!, y: g.y! }, data: g as unknown as Record<string, unknown>, draggable: false }));
    const e: Edge[] = edges.map((g, i) => ({
      id: `e${i}-${g.source}-${g.target}`,
      source: g.source,
      target: g.target,
      type: 'smoothstep',
      label: g.label,
      animated: g.animated,
      className: g.animated ? 'edge-active' : undefined,
      labelStyle: { fill: '#A99FB8', fontSize: 10 },
      labelBgStyle: { fill: '#1A0D33' },
    }));
    return { n, e };
  }, [nodes, edges]);

  return (
    <div style={{ height }} className={cx('rounded-card border border-border bg-bg', className)}>
      <ReactFlow
        nodes={rf.n}
        edges={rf.e}
        nodeTypes={nodeTypes}
        fitView={fit}
        fitViewOptions={{ padding: 0.15 }}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => onNodeClick?.(n.id)}
        minZoom={0.3}
      >
        <Background color="#3A2560" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
