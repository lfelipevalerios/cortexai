'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Channel, ConnectorStatus, EnvId, WorkspaceData } from '@cortex/schemas';
import { CONNECTOR_CATEGORIES } from '@cortex/schemas';
import { Graph, type GraphEdge, type GraphNode, type GraphTone } from '@/components/ui/Graph';

const STATUS_TONE: Record<ConnectorStatus, GraphTone> = {
  conectado: 'green', sincronizando: 'lilac', degradado: 'yellow', erro: 'red', pausado: 'muted', rascunho: 'muted',
};
const STATUS_LABEL: Record<ConnectorStatus, string> = {
  conectado: 'conectado', sincronizando: 'sincronizando', degradado: 'degradado', erro: 'com erro', pausado: 'pausado', rascunho: 'rascunho',
};

const BRAIN = '__cortex__';
const suffix = (id: string) => id.split('-').slice(2).join('-');

function matchChannel(ws: WorkspaceData, sysId: string, sysName: string): Channel | undefined {
  const s = suffix(sysId);
  return ws.channels.find((c) => suffix(c.id) === s) ?? ws.channels.find((c) => c.name === sysName) ?? ws.channels.find((c) => c.type === s);
}

export interface EcosystemStats {
  systems: number;
  connected: number;
  channels: number;
  activeChannels: number;
  journeys: number;
}

export function ecosystemModel(ws: WorkspaceData, env: EnvId, before: boolean): { nodes: GraphNode[]; edges: GraphEdge[]; stats: EcosystemStats } {
  const core = ws.systems.filter((s) => s.category !== 'canal');
  const canais = ws.systems.filter((s) => s.category === 'canal');
  const conn = (id?: string) => (id ? ws.connectors.find((c) => c.id === id) : undefined);
  const catLabel = (c: string) => (c === 'canal' ? 'Canal' : CONNECTOR_CATEGORIES[c as keyof typeof CONNECTOR_CATEGORIES] ?? c);

  if (before) {
    // As ilhas: cada sistema isolado, sem ligações, apagado.
    const all = [...core, ...canais];
    const nodes: GraphNode[] = all.map((s, i) => ({
      id: s.id,
      label: s.name,
      sublabel: catLabel(s.category),
      tone: 'muted',
      dim: true,
      x: (i % 4) * 250 + (Math.floor(i / 4) % 2 ? 90 : 0),
      y: Math.floor(i / 4) * 120 + ((i * 37) % 40),
    }));
    return { nodes, edges: [], stats: { systems: core.length, connected: 0, channels: canais.length, activeChannels: 0, journeys: 0 } };
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const ROW = 78;

  let connected = 0;
  core.forEach((s, i) => {
    const c = conn(s.connectorId);
    if (c) connected++;
    nodes.push({
      id: s.id,
      label: s.name,
      sublabel: c ? `${catLabel(s.category)} · ${STATUS_LABEL[c.status]}` : 'Ilha: sem conector',
      tone: c ? STATUS_TONE[c.status] : 'muted',
      dim: !c,
      x: 0,
      y: i * ROW,
    });
    if (c) edges.push({ source: s.id, target: BRAIN, animated: c.status === 'sincronizando' });
  });

  // Jornadas ativas no ambiente selecionado.
  const journeys = ws.journeys.filter((j) => j.envVersions[env]);
  const colH = (n: number) => (n - 1) * ROW;
  const maxH = Math.max(colH(core.length), colH(canais.length), colH(journeys.length));
  const offset = (n: number) => (maxH - colH(n)) / 2;

  nodes.push({ id: BRAIN, label: 'Córtex', sublabel: 'cérebro', tone: 'green', glow: true, shape: 'circle', x: 300, y: maxH / 2 - 18 });

  journeys.forEach((j, i) => {
    nodes.push({ id: j.id, label: j.name, sublabel: `jornada · v${j.envVersions[env]}`, tone: 'purple', glow: !!j.anchor, x: 560, y: offset(journeys.length) + i * ROW });
    edges.push({ source: BRAIN, target: j.id });
  });

  let activeChannels = 0;
  canais.forEach((s, i) => {
    const ch = matchChannel(ws, s.id, s.name);
    const active = ch?.status === 'ativo';
    if (active) activeChannels++;
    const jid = ch?.journeyByEnv[env];
    nodes.push({
      id: s.id,
      label: ch?.name ?? s.name,
      sublabel: active ? 'canal ativo' : 'canal sem ligação',
      tone: active ? 'lilac' : 'muted',
      dim: !active,
      x: 860,
      y: offset(canais.length) + i * ROW,
    });
    if (!active) return;
    if (jid && journeys.some((j) => j.id === jid)) edges.push({ source: jid, target: s.id, animated: true });
    else edges.push({ source: BRAIN, target: s.id });
  });

  // Ajuste vertical da coluna de sistemas.
  const off = offset(core.length);
  nodes.forEach((n) => {
    if (n.x === 0) n.y = (n.y ?? 0) + off;
  });

  return { nodes, edges, stats: { systems: core.length, connected, channels: canais.length, activeChannels, journeys: journeys.length } };
}

export function EcosystemMap({ ws, env, before, height = 380 }: { ws: WorkspaceData; env: EnvId; before: boolean; height?: number }) {
  const router = useRouter();
  const model = useMemo(() => ecosystemModel(ws, env, before), [ws, env, before]);
  return (
    <Graph
      key={`${before ? 'antes' : 'com'}-${env}-${model.nodes.length}-${model.edges.length}`}
      nodes={model.nodes}
      edges={model.edges}
      height={height}
      onNodeClick={(id) => {
        if (before || id === BRAIN) return;
        if (ws.journeys.some((j) => j.id === id)) router.push(`/jornadas/studio?id=${encodeURIComponent(id)}`);
        else if (ws.systems.find((s) => s.id === id)?.category === 'canal') router.push('/canais');
        else router.push('/conectores');
      }}
    />
  );
}
