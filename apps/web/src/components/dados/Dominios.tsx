'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DataDomain, WorkspaceData } from '@cortex/schemas';
import { formatNumber, latestContractVersion } from '@cortex/engine';
import { Database, FileText, Users, Workflow, ShieldCheck, Boxes } from 'lucide-react';
import { Chip, Drawer, StatusChip, Mono, cx } from '@/components/ui';
import { avgQuality, studioHref } from './shared';

interface DomainNodeData {
  domain: DataDomain;
  tour?: string;
  layers: { bronze: number; prata: number; ouro: number };
  quality: number | null;
  ownerName: string;
  selected: boolean;
}

function DomainNode({ data }: NodeProps) {
  const d = data as unknown as DomainNodeData;
  const business = d.domain.kind === 'negocio';
  return (
    <div
      data-tour={d.tour}
      className={cx(
        'w-[220px] cursor-pointer rounded-card border bg-surface-1 px-3 py-2.5 transition-all duration-200',
        business ? 'border-accent/60' : 'border-primary/60',
        d.selected && (business ? 'shadow-halo-purple' : 'shadow-halo-green'),
      )}
    >
      <Handle id="t" type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
      <Handle id="l" type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm font-semibold text-text">{d.domain.name}</div>
        <Chip tone={business ? 'purple' : 'green'}>{business ? 'Negócio' : 'Técnico'}</Chip>
      </div>
      <div className="mt-1 truncate text-[11px] text-text-muted">Dono: {d.ownerName}</div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-text-muted">
        <span className="rounded-full border border-warning/40 px-1.5 text-warning" title="Tabelas Bronze">B {d.layers.bronze}</span>
        <span className="rounded-full border border-border px-1.5" title="Tabelas Prata">P {d.layers.prata}</span>
        <span className="rounded-full border border-primary/40 px-1.5 text-primary" title="Tabelas Ouro">O {d.layers.ouro}</span>
        <span className="ml-auto">{d.quality === null ? 'sem regras' : `qualidade ${formatNumber(d.quality, 1)}%`}</span>
      </div>
      <Handle id="r" type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
      <Handle id="b" type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
    </div>
  );
}

const nodeTypes = { domain: DomainNode };

export function DominiosTab({ ws, highlightDomainId, onOpenContract }: { ws: WorkspaceData; highlightDomainId?: string; onOpenContract: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const userName = (id: string) => ws.users.find((u) => u.id === id || u.name === id)?.name ?? id;

  const { nodes, edges } = useMemo(() => {
    const byId = new Map(ws.domains.map((d) => [d.id, d]));
    const nodes: Node[] = ws.domains.map((d) => {
      const tables = ws.tables.filter((t) => t.domainId === d.id);
      const data: DomainNodeData = {
        domain: d,
        tour: d.id === highlightDomainId ? 'dados-dominio-cliente' : undefined,
        layers: {
          bronze: tables.filter((t) => t.layer === 'bronze').length,
          prata: tables.filter((t) => t.layer === 'prata').length,
          ouro: tables.filter((t) => t.layer === 'ouro').length,
        },
        quality: avgQuality(ws.contracts.filter((c) => c.domainId === d.id)),
        ownerName: userName(d.owner),
        selected: selected === d.id,
      };
      return { id: d.id, type: 'domain', position: d.position, data: data as unknown as Record<string, unknown>, draggable: false };
    });
    const seen = new Set<string>();
    const edges: Edge[] = [];
    for (const d of ws.domains) {
      for (const r of d.relations) {
        const o = byId.get(r);
        if (!o) continue;
        const key = [d.id, r].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const dx = o.position.x - d.position.x;
        const dy = o.position.y - d.position.y;
        let source = d, target = o, sh = 'r', th = 'l';
        if (Math.abs(dx) >= Math.abs(dy)) {
          if (dx < 0) [source, target] = [o, d];
        } else {
          sh = 'b';
          th = 't';
          if (dy < 0) [source, target] = [o, d];
        }
        const tech = d.kind === 'tecnico' || o.kind === 'tecnico';
        edges.push({
          id: `rel-${key}`, source: source.id, target: target.id, sourceHandle: sh, targetHandle: th, type: 'smoothstep',
          style: { stroke: tech ? '#00FF9566' : '#A07EFC88', strokeWidth: 1.5 },
        });
      }
    }
    return { nodes, edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, highlightDomainId, selected]);

  const domain = ws.domains.find((d) => d.id === selected);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> Domínio de negócio</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Domínio técnico (eventos, logs)</span>
        <span>B/P/O = tabelas Bronze, Prata e Ouro do domínio. Clique em um domínio para ver o detalhe.</span>
      </div>
      <div className="h-[520px] rounded-card border border-border bg-bg">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, n) => setSelected(n.id)}
          minZoom={0.3}
        >
          <Background color="#3A2560" gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <Drawer open={!!domain} onClose={() => setSelected(null)} width={460} title={domain ? `Domínio ${domain.name}` : ''} subtitle={domain?.description}>
        {domain && <DomainDetail ws={ws} domain={domain} ownerName={userName(domain.owner)} onOpenContract={(id) => { setSelected(null); onOpenContract(id); }} />}
      </Drawer>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {title}
      </div>
      {children}
    </div>
  );
}

function DomainDetail({ ws, domain, ownerName, onOpenContract }: { ws: WorkspaceData; domain: DataDomain; ownerName: string; onOpenContract: (id: string) => void }) {
  const contracts = ws.contracts.filter((c) => c.domainId === domain.id);
  const products = ws.tables.filter((t) => domain.products.includes(t.id) || (t.domainId === domain.id && t.layer === 'ouro'));
  const journeys = ws.journeys.filter((j) => domain.consumers.includes(j.id) || j.domainId === domain.id);
  const quality = avgQuality(contracts);
  const failing = contracts.flatMap((c) => (latestContractVersion(c)?.quality ?? []).filter((q) => q.lastResult === 'falha').map((q) => ({ c, q })));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Chip tone={domain.kind === 'negocio' ? 'purple' : 'green'}>{domain.kind === 'negocio' ? 'Domínio de negócio' : 'Domínio técnico'}</Chip>
        <Chip tone="muted" icon={Users}>Dono: {ownerName}</Chip>
      </div>

      <Section title="Entidades" icon={Boxes}>
        <div className="flex flex-wrap gap-1.5">
          {domain.entities.map((e) => <Chip key={e} tone="lilac">{e}</Chip>)}
        </div>
      </Section>

      <Section title="Contratos" icon={FileText}>
        {contracts.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum contrato publicado neste domínio.</p>
        ) : (
          <ul className="space-y-1.5">
            {contracts.map((c) => (
              <li key={c.id}>
                <button onClick={() => onOpenContract(c.id)} className="flex w-full items-center justify-between rounded-field border border-border bg-surface-2 px-3 py-2 text-left text-sm hover:border-accent">
                  <span>{c.name} <Mono className="text-text-muted">v{latestContractVersion(c)?.version}</Mono></span>
                  <StatusChip status={c.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Qualidade" icon={ShieldCheck}>
        <div className="text-sm">
          {quality === null ? 'Sem regras de qualidade.' : <>Média das últimas execuções: <span className="font-semibold text-primary">{formatNumber(quality, 1)}%</span></>}
        </div>
        {failing.map(({ c, q }) => (
          <div key={q.id} className="mt-2 flex items-center gap-2 text-xs">
            <StatusChip status="falha" /> <span className="text-text-muted">{c.name}: <Mono>{q.expression}</Mono></span>
          </div>
        ))}
      </Section>

      <Section title="Produtos de dados (Ouro)" icon={Database}>
        {products.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum produto de dados publicado ainda.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {products.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-field border border-border px-3 py-2">
                <Mono>{t.name}</Mono>
                <span className="text-xs text-text-muted">{formatNumber(t.rows)} linhas</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Jornadas consumidoras" icon={Workflow}>
        {journeys.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma jornada consome este domínio.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {journeys.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-2 rounded-field border border-border px-3 py-2">
                <Link href={studioHref(j.id)} className="truncate text-accent hover:underline">{j.name}</Link>
                <span className="text-xs text-text-muted">{j.envVersions.prd ? `Prd v${j.envVersions.prd}` : j.envVersions.hml ? `Hml v${j.envVersions.hml}` : 'Dev'}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
