'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LineageNode, WorkspaceData } from '@cortex/schemas';
import { GitBranch, ArrowRight } from 'lucide-react';
import { Card, CardHeader, Chip, EmptyState, type ChipTone } from '@/components/ui';
import { Graph, type GraphTone } from '@/components/ui/Graph';
import { studioHref } from './shared';

const KIND: Record<LineageNode['kind'], { label: string; tone: GraphTone; chip: ChipTone }> = {
  conector: { label: 'Conector', tone: 'lilac', chip: 'lilac' },
  bronze: { label: 'Bronze', tone: 'yellow', chip: 'yellow' },
  prata: { label: 'Prata', tone: 'muted', chip: 'muted' },
  ouro: { label: 'Ouro', tone: 'green', chip: 'green' },
  contrato: { label: 'Contrato', tone: 'purple', chip: 'purple' },
  jornada: { label: 'Jornada', tone: 'green', chip: 'green' },
  canal: { label: 'Canal', tone: 'lilac', chip: 'lilac' },
};
const ORDER: LineageNode['kind'][] = ['conector', 'bronze', 'prata', 'ouro', 'contrato', 'jornada', 'canal'];

export function LinhagemTab({ ws, onOpenContract, onOpenTable }: { ws: WorkspaceData; onOpenContract: (id: string) => void; onOpenTable: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { nodes, edges } = ws.lineage;

  const downstream = useMemo(() => {
    if (!selected) return new Set<string>();
    const out = new Set<string>();
    const queue = [selected];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of edges) {
        if (e.source === id && !out.has(e.target)) {
          out.add(e.target);
          queue.push(e.target);
        }
      }
    }
    return out;
  }, [selected, edges]);

  const gNodes = useMemo(() => {
    // Colunas fixas por tipo para ler da origem ao uso.
    const rows = new Map<string, number>();
    return nodes.map((n) => {
      const col = ORDER.indexOf(n.kind);
      const row = rows.get(n.kind) ?? 0;
      rows.set(n.kind, row + 1);
      return {
        id: n.id,
        label: n.label,
        sublabel: KIND[n.kind].label,
        tone: KIND[n.kind].tone,
        glow: n.id === selected || downstream.has(n.id),
        dim: !!selected && n.id !== selected && !downstream.has(n.id),
        x: col * 230,
        y: row * 90,
      };
    });
  }, [nodes, selected, downstream]);

  const gEdges = useMemo(() => edges.map((e) => ({ ...e, animated: !!selected && (e.source === selected || downstream.has(e.source)) && downstream.has(e.target) })), [edges, selected, downstream]);

  const node = nodes.find((n) => n.id === selected);
  const impacted = nodes.filter((n) => downstream.has(n.id)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          {ORDER.map((k, i) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <Chip tone={KIND[k].chip}>{KIND[k].label}</Chip>
              {i < ORDER.length - 1 && <ArrowRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
        <Graph nodes={gNodes} edges={gEdges} height={520} onNodeClick={(id) => setSelected((s) => (s === id ? null : id))} />
      </div>
      <Card className="h-fit">
        <CardHeader title="Impacto de uma mudança" subtitle={node ? `A partir de ${node.label}` : 'Clique em um nó do grafo'} icon={GitBranch} />
        <div className="p-4">
          {!node ? (
            <EmptyState title="Nenhum nó selecionado" description="Selecione um conector, tabela ou contrato para ver tudo o que depende dele até o canal." />
          ) : impacted.length === 0 ? (
            <p className="text-sm text-text-muted">Nada depende de {node.label}: é o fim da linhagem.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Uma mudança em <span className="font-semibold">{node.label}</span> afeta <span className="font-semibold text-warning">{impacted.length}</span> itens:
              </p>
              {ORDER.filter((k) => impacted.some((n) => n.kind === k)).map((k) => (
                <div key={k}>
                  <div className="mb-1 text-xs font-medium text-text-muted">{KIND[k].label}</div>
                  <ul className="space-y-1">
                    {impacted.filter((n) => n.kind === k).map((n) => (
                      <li key={n.id} className="flex items-center justify-between gap-2 rounded-field border border-border px-2.5 py-1.5 text-sm">
                        <span className="truncate">{n.label}</span>
                        <NodeLink n={n} onOpenContract={onOpenContract} onOpenTable={onOpenTable} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {ws.journeys.some((j) => impacted.some((n) => n.refId === j.id && j.envVersions.prd)) && (
                <p className="rounded-field border border-warning/40 bg-warning/5 p-2 text-xs text-warning">
                  Há jornada em Prd no caminho: mudanças incompatíveis serão bloqueadas na publicação do contrato.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function NodeLink({ n, onOpenContract, onOpenTable }: { n: LineageNode; onOpenContract: (id: string) => void; onOpenTable: (id: string) => void }) {
  if (!n.refId) return null;
  const cls = 'shrink-0 text-xs text-accent hover:underline';
  if (n.kind === 'contrato') return <button className={cls} onClick={() => onOpenContract(n.refId!)}>Abrir</button>;
  if (n.kind === 'bronze' || n.kind === 'prata' || n.kind === 'ouro') return <button className={cls} onClick={() => onOpenTable(n.refId!)}>Explorar</button>;
  if (n.kind === 'jornada') return <Link className={cls} href={studioHref(n.refId)}>Studio</Link>;
  if (n.kind === 'canal') return <Link className={cls} href="/canais">Canais</Link>;
  if (n.kind === 'conector') return <Link className={cls} href="/conectores">Conectores</Link>;
  return null;
}
