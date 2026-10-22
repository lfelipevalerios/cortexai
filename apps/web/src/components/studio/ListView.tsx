'use client';

// Visão em lista equivalente ao canvas (acessibilidade): etapas, ligações e problemas,
// com ligar e remover pelo teclado.
import { useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { NODE_CATEGORIES, type JourneyGraph } from '@cortex/schemas';
import { isConnectionAllowed, type GraphProblem } from '@cortex/engine';
import { Button, Chip, cx } from '@/components/ui';
import { iconForKind, kindLabel } from './icons';
import { buildOrderOf } from './lib';

export function ListView({
  graph, problemsByNode, editable, selectedId, onSelect, onConnect, onRemove,
}: {
  graph: JourneyGraph;
  problemsByNode: Map<string, GraphProblem[]>;
  editable: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  onConnect: (source: string, target: string, handle?: string) => void;
  onRemove: (id: string) => void;
}) {
  const ordered = buildOrderOf(graph);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return (
    <div className="h-full overflow-auto p-3">
      <ol aria-label="Etapas da jornada" className="space-y-2">
        {ordered.map((n, i) => {
          const Icon = iconForKind(n.kind);
          const outs = graph.edges.filter((e) => e.source === n.id);
          const probs = problemsByNode.get(n.id) ?? [];
          return (
            <li
              key={n.id}
              className={cx('rounded-field border bg-surface-1 p-3', selectedId === n.id ? 'border-accent' : 'border-border')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-text-muted">{i + 1}.</span>
                <Icon className="h-4 w-4" style={{ color: NODE_CATEGORIES[n.category].color }} strokeWidth={1.5} aria-hidden />
                <button className="text-sm font-medium hover:underline" onClick={() => onSelect(n.id)}>
                  {n.label}
                </button>
                <span className="text-xs text-text-muted">{NODE_CATEGORIES[n.category].label} · {kindLabel(n.kind)}</span>
                {probs.map((p) => (
                  <Chip key={p.id} tone={p.severity === 'erro' ? 'red' : 'yellow'}>{p.severity === 'erro' ? 'Erro' : 'Aviso'}: {p.message}</Chip>
                ))}
              </div>
              <div className="mt-1 text-xs text-text-muted">
                {outs.length === 0
                  ? 'Sem saída ligada.'
                  : `Segue para: ${outs.map((e) => `${byId.get(e.target)?.label ?? e.target}${e.sourceHandle ? ` (${e.sourceHandle})` : ''}`).join(', ')}`}
              </div>
              {editable && <ConnectRow graph={graph} sourceId={n.id} onConnect={onConnect} onRemove={() => onRemove(n.id)} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ConnectRow({ graph, sourceId, onConnect, onRemove }: { graph: JourneyGraph; sourceId: string; onConnect: (s: string, t: string, h?: string) => void; onRemove: () => void }) {
  const src = graph.nodes.find((n) => n.id === sourceId)!;
  const [target, setTarget] = useState('');
  const [handle, setHandle] = useState(src.outputs?.[0] ?? '');
  const check = target ? isConnectionAllowed(graph, sourceId, target, handle || undefined) : undefined;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <label className="flex items-center gap-1">
        Ligar a
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-field border border-border bg-surface-2 px-2 py-1">
          <option value="">escolha um nó</option>
          {graph.nodes.filter((n) => n.id !== sourceId).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </label>
      {src.outputs?.length ? (
        <label className="flex items-center gap-1">
          pela saída
          <select value={handle} onChange={(e) => setHandle(e.target.value)} className="rounded-field border border-border bg-surface-2 px-2 py-1">
            {src.outputs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      ) : null}
      <Button size="sm" variant="tertiary" icon={Link2} disabled={!check?.allowed} onClick={() => onConnect(sourceId, target, handle || undefined)}>
        Ligar
      </Button>
      {check && !check.allowed && <span className="text-warning">{check.reason}</span>}
      <Button size="sm" variant="ghost" icon={Trash2} onClick={onRemove} className="ml-auto text-danger">
        Remover
      </Button>
    </div>
  );
}
