// Operações de edição do grafo usadas pelo Studio. Todas são puras.
import type { JourneyEdge, JourneyGraph, JourneyNode, NodeCategory, NodeKindDef } from '@cortex/schemas';

function uniqueNodeId(graph: JourneyGraph, base: string): string {
  const ids = new Set(graph.nodes.map((n) => n.id));
  let n = 1;
  while (ids.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Cria um nó a partir da paleta. Retorna o grafo novo e o nó criado. */
export function addNode(
  graph: JourneyGraph,
  kindDef: NodeKindDef,
  position: { x: number; y: number },
  extra: Partial<Omit<JourneyNode, 'id' | 'kind' | 'category'>> = {},
): { graph: JourneyGraph; node: JourneyNode } {
  const base = kindDef.kind.split('.')[1] ?? kindDef.category;
  const node: JourneyNode = {
    id: uniqueNodeId(graph, base),
    kind: kindDef.kind,
    category: kindDef.category,
    label: kindDef.label,
    position: { x: position.x, y: position.y },
    ...(kindDef.outputs ? { outputs: [...kindDef.outputs] } : {}),
    ...extra,
  };
  return { graph: { nodes: [...graph.nodes, node], edges: graph.edges }, node };
}

export interface ConnectionCheck {
  allowed: boolean;
  reason?: string;
}

/** Regras de compatibilidade das ligações do canvas. */
export function isConnectionAllowed(graph: JourneyGraph, source: string, target: string, sourceHandle?: string): ConnectionCheck {
  const s = graph.nodes.find((n) => n.id === source);
  const t = graph.nodes.find((n) => n.id === target);
  if (!s || !t) return { allowed: false, reason: 'Nó inexistente' };
  if (source === target) return { allowed: false, reason: 'Um nó não pode se ligar a ele mesmo' };
  if (t.category === 'gatilho') return { allowed: false, reason: 'Gatilhos não recebem ligações' };
  if (s.kind === 'saida.encerrar') return { allowed: false, reason: '«Encerrar» é o fim do fluxo' };
  if (sourceHandle && s.outputs?.length && !s.outputs.includes(sourceHandle))
    return { allowed: false, reason: `A saída «${sourceHandle}» não existe em «${s.label}»` };
  const dup = graph.edges.some(
    (e) => e.source === source && e.target === target && (e.sourceHandle ?? '') === (sourceHandle ?? ''),
  );
  if (dup) return { allowed: false, reason: 'Essa ligação já existe' };
  return { allowed: true };
}

/** Liga dois nós; devolve o grafo inalterado se a ligação não for permitida. */
export function connect(graph: JourneyGraph, source: string, target: string, sourceHandle?: string): JourneyGraph {
  const s = graph.nodes.find((n) => n.id === source);
  let handle = sourceHandle;
  // Em nó de decisão sem saída escolhida, usa a primeira saída livre.
  if (!handle && s?.outputs?.length) {
    const usedHandles = new Set(graph.edges.filter((e) => e.source === source).map((e) => e.sourceHandle));
    handle = s.outputs.find((o) => !usedHandles.has(o)) ?? s.outputs[0];
  }
  if (!isConnectionAllowed(graph, source, target, handle).allowed) return graph;
  const ids = new Set(graph.edges.map((e) => e.id));
  const base = `e-${source}-${target}${handle ? `-${handle}` : ''}`;
  let id = base;
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
  const edge: JourneyEdge = { id, source, target, ...(handle ? { sourceHandle: handle, label: handle } : {}) };
  return { nodes: graph.nodes, edges: [...graph.edges, edge] };
}

export function removeNodes(graph: JourneyGraph, ids: string[]): JourneyGraph {
  const del = new Set(ids);
  return {
    nodes: graph.nodes.filter((n) => !del.has(n.id)),
    edges: graph.edges.filter((e) => !del.has(e.source) && !del.has(e.target)),
  };
}

export function removeEdges(graph: JourneyGraph, ids: string[]): JourneyGraph {
  const del = new Set(ids);
  return { nodes: graph.nodes, edges: graph.edges.filter((e) => !del.has(e.id)) };
}

/** JSON com chaves ordenadas, para comparar configs. */
function stable(v: unknown): string {
  if (v === undefined) return '';
  if (!v || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v as object)
    .sort()
    .map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

function signature(n: JourneyNode): string {
  return stable({
    kind: n.kind,
    label: n.label,
    config: n.config ?? {},
    componentId: n.componentId,
    componentVersion: n.componentVersion,
    ruleId: n.ruleId,
    contractId: n.contractId,
    toolId: n.toolId,
    channelId: n.channelId,
    emitsPii: !!n.emitsPii,
  });
}

/** Diff visual entre versões: ids de nós adicionados, removidos e alterados. */
export function diffGraphs(a: JourneyGraph, b: JourneyGraph): { added: string[]; removed: string[]; changed: string[] } {
  const before = new Map(a.nodes.map((n) => [n.id, n]));
  const after = new Map(b.nodes.map((n) => [n.id, n]));
  return {
    added: b.nodes.filter((n) => !before.has(n.id)).map((n) => n.id),
    removed: a.nodes.filter((n) => !after.has(n.id)).map((n) => n.id),
    changed: b.nodes.filter((n) => before.has(n.id) && signature(before.get(n.id)!) !== signature(n)).map((n) => n.id),
  };
}

const NEXT_BY_CATEGORY: Record<NodeCategory, string[]> = {
  gatilho: ['agente.intencao', 'agente.agente', 'logica.condicao'],
  agente: ['conhecimento.regra', 'dados.tool', 'conhecimento.buscar', 'guardrail.pii'],
  conhecimento: ['agente.agente', 'logica.tabela', 'saida.responder'],
  dados: ['guardrail.pii', 'logica.condicao', 'agente.resumir'],
  logica: ['agente.agente', 'pessoas.aprovacao', 'saida.responder'],
  pessoas: ['saida.responder', 'saida.notificar', 'saida.encerrar'],
  guardrail: ['saida.responder', 'saida.notificar', 'saida.encerrar'],
  saida: ['saida.encerrar'],
};

const NEXT_BY_KIND: Record<string, string[]> = {
  'agente.intencao': ['logica.condicao', 'agente.agente', 'conhecimento.buscar'],
  'agente.extrair': ['logica.tabela', 'dados.tool', 'guardrail.pii'],
  'logica.tabela': ['logica.condicao', 'pessoas.aprovacao', 'saida.responder'],
  'pessoas.aprovacao': ['dados.tool', 'saida.notificar', 'saida.encerrar'],
  'guardrail.pii': ['saida.responder', 'agente.resumir', 'saida.encerrar'],
  'saida.encerrar': [],
};

/** Sugere o próximo nó mais comum a partir do nó selecionado. */
export function suggestNextKinds(graph: JourneyGraph, nodeId: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  let list = [...(NEXT_BY_KIND[node.kind] ?? NEXT_BY_CATEGORY[node.category] ?? [])];
  if (node.emitsPii) list = ['guardrail.pii', ...list.filter((k) => k !== 'guardrail.pii')];
  // Não repete o que já está ligado logo em seguida.
  const nextKinds = new Set(
    graph.edges.filter((e) => e.source === nodeId).map((e) => graph.nodes.find((n) => n.id === e.target)?.kind),
  );
  const filtered = list.filter((k) => !nextKinds.has(k));
  return filtered.length ? filtered : list;
}

export function graphToJson(graph: JourneyGraph): string {
  return JSON.stringify(graph, null, 2);
}
