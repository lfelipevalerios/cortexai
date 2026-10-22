'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { KnowledgeGraph, WorkspaceData } from '@cortex/schemas';
import { Share2 } from 'lucide-react';
import { Card, CardHeader, Chip, EmptyState, Button, type ChipTone } from '@/components/ui';
import { Graph, type GraphTone } from '@/components/ui/Graph';

type Kind = KnowledgeGraph['nodes'][number]['kind'];
const KIND: Record<Kind, { label: string; tone: GraphTone; chip: ChipTone; col: number }> = {
  entidade: { label: 'Entidade', tone: 'purple', chip: 'purple', col: 0 },
  tabela: { label: 'Tabela', tone: 'green', chip: 'green', col: 1 },
  documento: { label: 'Documento', tone: 'lilac', chip: 'lilac', col: 2 },
  regra: { label: 'Regra', tone: 'yellow', chip: 'yellow', col: 3 },
};

export function GrafoTab({ ws, onOpenDoc }: { ws: WorkspaceData; onOpenDoc: (id: string) => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const g = ws.knowledgeGraph;

  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    g.edges.forEach((e) => {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    });
    return s;
  }, [g, selected]);

  const nodes = useMemo(() => {
    const rows = new Map<Kind, number>();
    return g.nodes.map((n) => {
      const r = rows.get(n.kind) ?? 0;
      rows.set(n.kind, r + 1);
      return {
        id: n.id,
        label: n.label,
        sublabel: KIND[n.kind].label,
        tone: KIND[n.kind].tone,
        glow: n.id === selected,
        dim: !!selected && n.id !== selected && !neighbors.has(n.id),
        x: KIND[n.kind].col * 260,
        y: r * 90,
      };
    });
  }, [g, selected, neighbors]);

  const edges = useMemo(() => g.edges.map((e) => ({ ...e, animated: !!selected && (e.source === selected || e.target === selected) })), [g, selected]);
  const node = g.nodes.find((n) => n.id === selected);

  const openObject = (id: string, kind: Kind) => {
    if (kind === 'documento') onOpenDoc(id);
    else if (kind === 'tabela') router.push(`/dados?tabela=${id}`);
    else if (kind === 'regra') router.push(`/cerebro?regra=${id}`);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          {(Object.keys(KIND) as Kind[]).map((k) => <Chip key={k} tone={KIND[k].chip}>{KIND[k].label}</Chip>)}
          <span className="text-xs text-text-muted">Clique em um nó para ver as ligações e abrir o objeto.</span>
        </div>
        <Graph nodes={nodes} edges={edges} height={540} onNodeClick={(id) => setSelected((s) => (s === id ? null : id))} />
      </div>
      <Card className="h-fit">
        <CardHeader title={node ? node.label : 'Grafo de conhecimento'} subtitle={node ? KIND[node.kind].label : 'Entidades ligadas a tabelas, documentos e regras'} icon={Share2} />
        <div className="space-y-3 p-4">
          {!node ? (
            <EmptyState title="Nenhum nó selecionado" description="Escolha uma entidade de negócio para ver onde ela está nos dados, nos documentos e nas regras." />
          ) : (
            <>
              {node.kind !== 'entidade' && (
                <Button size="sm" variant="tertiary" onClick={() => openObject(node.id, node.kind)}>
                  {node.kind === 'documento' ? 'Abrir documento' : node.kind === 'tabela' ? 'Abrir no lakehouse' : 'Abrir regra no cérebro'}
                </Button>
              )}
              <div className="text-xs font-medium text-text-muted">Ligações ({neighbors.size})</div>
              <ul className="space-y-1.5">
                {g.edges
                  .filter((e) => e.source === node.id || e.target === node.id)
                  .map((e, i) => {
                    const otherId = e.source === node.id ? e.target : e.source;
                    const other = g.nodes.find((n) => n.id === otherId);
                    if (!other) return null;
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-field border border-border px-2.5 py-1.5 text-sm">
                        <button className="truncate text-left hover:text-accent" onClick={() => setSelected(other.id)}>
                          {e.label && <span className="text-xs text-text-muted">{e.label} · </span>}
                          {other.label}
                        </button>
                        <Chip tone={KIND[other.kind].chip}>{KIND[other.kind].label}</Chip>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
