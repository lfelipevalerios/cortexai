// Validação enquanto desenha (seção 7): problemas com selo e correção em um clique.
import type { EnvId, Journey, JourneyEdge, JourneyGraph, JourneyNode, WorkspaceData } from '@cortex/schemas';

export interface GraphProblem {
  id: string;
  nodeId?: string;
  severity: 'erro' | 'aviso';
  code: string;
  message: string;
  fix?: { label: string; apply: (g: JourneyGraph) => JourneyGraph };
}

export interface ValidateContext {
  data: WorkspaceData;
  env: EnvId;
  /** Nível de risco da jornada; ativa a checagem de autonomia. */
  risk?: Journey['risk'];
}

const NOT_APPROVED = new Set(['rascunho', 'em_revisao', 'depreciado']);
const STATUS_LABEL: Record<string, string> = {
  rascunho: 'em rascunho',
  em_revisao: 'em revisão',
  depreciado: 'depreciado',
};

function isChannelSink(n: JourneyNode): boolean {
  return n.kind === 'saida.responder' || !!n.channelId;
}

/** Busca um caminho do nó emissor até um canal sem passar por filtro de PII. */
function findUnfilteredPiiPath(graph: JourneyGraph, emitter: JourneyNode): { firstEdge: JourneyEdge; sink: JourneyNode } | null {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const visited = new Set<string>([emitter.id]);
  // Pilha com o primeiro elo do caminho para saber onde inserir o filtro.
  const stack: { nodeId: string; firstEdge: JourneyEdge }[] = graph.edges
    .filter((e) => e.source === emitter.id)
    .reverse()
    .map((e) => ({ nodeId: e.target, firstEdge: e }));
  while (stack.length) {
    const { nodeId, firstEdge } = stack.pop()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = byId.get(nodeId);
    if (!node || node.kind === 'guardrail.pii') continue;
    if (isChannelSink(node)) return { firstEdge, sink: node };
    const next = graph.edges.filter((e) => e.source === nodeId).reverse();
    for (const e of next) stack.push({ nodeId: e.target, firstEdge });
  }
  return null;
}

function nextFilterId(graph: JourneyGraph): string {
  const ids = new Set(graph.nodes.map((n) => n.id));
  let n = 1;
  while (ids.has(`pii-filter-${n}`)) n++;
  return `pii-filter-${n}`;
}

function downstreamOf(graph: JourneyGraph, startId: string, exclude: string): Set<string> {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || id === exclude) continue;
    seen.add(id);
    for (const e of graph.edges) if (e.source === id) stack.push(e.target);
  }
  return seen;
}

const NODE_GAP = 240;

/** Insere um nó guardrail.pii no elo indicado, reposicionando o fluxo seguinte se faltar espaço. */
export function insertPiiFilter(graph: JourneyGraph, edgeId: string, componentId?: string): JourneyGraph {
  const edge = graph.edges.find((e) => e.id === edgeId);
  if (!edge) return graph;
  const src = graph.nodes.find((n) => n.id === edge.source);
  const tgt = graph.nodes.find((n) => n.id === edge.target);
  if (!src || !tgt) return graph;
  const id = nextFilterId(graph);
  const dx = tgt.position.x - src.position.x;
  const dy = tgt.position.y - src.position.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  let position = { x: (src.position.x + tgt.position.x) / 2, y: (src.position.y + tgt.position.y) / 2 };
  let nodes = graph.nodes;
  const span = horizontal ? Math.abs(dx) : Math.abs(dy);
  if (span < NODE_GAP * 2) {
    // Abre espaço deslocando o fluxo a jusante.
    const dir = (horizontal ? dx : dy) >= 0 ? 1 : -1;
    const shift = NODE_GAP * 2 - span;
    const down = downstreamOf(graph, tgt.id, src.id);
    nodes = nodes.map((n) =>
      down.has(n.id)
        ? { ...n, position: horizontal ? { x: n.position.x + shift * dir, y: n.position.y } : { x: n.position.x, y: n.position.y + shift * dir } }
        : n,
    );
    position = horizontal
      ? { x: src.position.x + NODE_GAP * dir, y: src.position.y }
      : { x: src.position.x, y: src.position.y + NODE_GAP * dir };
  }
  const filter: JourneyNode = {
    id,
    kind: 'guardrail.pii',
    category: 'guardrail',
    label: 'Filtro de PII',
    position,
    ...(componentId ? { componentId } : {}),
  };
  const edges = graph.edges.flatMap((e) =>
    e.id === edgeId
      ? [
          { ...e, target: id },
          { id: `e-${id}-${tgt.id}`, source: id, target: tgt.id },
        ]
      : [e],
  );
  return { nodes: [...nodes, filter], edges };
}

export function validateGraph(graph: JourneyGraph, ctx: ValidateContext): GraphProblem[] {
  const { data, env } = ctx;
  const problems: GraphProblem[] = [];
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const e of graph.edges) {
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
  }

  if (!graph.nodes.some((n) => n.category === 'gatilho')) {
    problems.push({ id: 'sem_gatilho', severity: 'erro', code: 'sem_gatilho', message: 'A jornada não tem gatilho de início' });
  }

  const components = new Map(data.components.map((c) => [c.id, c]));
  const ruleIds = new Set([...data.decisionTables.map((t) => t.id), ...data.components.map((c) => c.id)]);
  const contractIds = new Set(data.contracts.map((c) => c.id));
  const toolIds = new Set(data.connectors.flatMap((c) => c.tools.map((t) => t.id)));
  const piiHook = data.components.find((c) => c.type === 'hook' && /pii/i.test(c.name));

  for (const node of graph.nodes) {
    const label = `«${node.label}»`;
    if (graph.nodes.length > 1 && !incoming.get(node.id) && !outgoing.get(node.id)) {
      problems.push({ id: `desconectado:${node.id}`, nodeId: node.id, severity: 'aviso', code: 'no_desconectado', message: `${label} não está ligado a nenhum outro nó` });
    } else if (node.category !== 'gatilho' && !incoming.get(node.id)) {
      problems.push({ id: `sem_entrada:${node.id}`, nodeId: node.id, severity: 'aviso', code: 'no_inalcancavel', message: `${label} não recebe nenhuma ligação e nunca será executado` });
    }

    if (node.componentId) {
      const comp = components.get(node.componentId);
      if (!comp) {
        problems.push({ id: `componente:${node.id}`, nodeId: node.id, severity: 'erro', code: 'componente_inexistente', message: `${label} usa um componente que não existe no catálogo` });
      } else if (NOT_APPROVED.has(comp.status)) {
        problems.push({
          id: `componente:${node.id}`,
          nodeId: node.id,
          severity: env === 'prd' ? 'erro' : 'aviso',
          code: 'componente_nao_homologado',
          message: `${label} usa o componente «${comp.name}» ${STATUS_LABEL[comp.status]}`,
        });
      }
    }
    if (node.ruleId && !ruleIds.has(node.ruleId)) {
      problems.push({ id: `regra:${node.id}`, nodeId: node.id, severity: 'erro', code: 'regra_inexistente', message: `${label} consulta uma regra que não existe no cérebro` });
    }
    if (node.contractId && !contractIds.has(node.contractId)) {
      problems.push({ id: `contrato:${node.id}`, nodeId: node.id, severity: 'erro', code: 'contrato_inexistente', message: `${label} lê um contrato de dados inexistente` });
    }
    if (node.toolId && !toolIds.has(node.toolId)) {
      problems.push({ id: `tool:${node.id}`, nodeId: node.id, severity: 'erro', code: 'tool_inexistente', message: `${label} usa uma tool que nenhum conector oferece` });
    }

    if (node.outputs?.length) {
      const handles = graph.edges.filter((e) => e.source === node.id).map((e) => (e.sourceHandle ?? e.label ?? '').toLowerCase());
      for (const out of node.outputs) {
        if (!handles.includes(out.toLowerCase())) {
          problems.push({ id: `saida:${node.id}:${out}`, nodeId: node.id, severity: 'aviso', code: 'saida_sem_ligacao', message: `A saída «${out}» de ${label} não leva a nenhum nó` });
        }
      }
    }

    if (node.emitsPii) {
      const path = findUnfilteredPiiPath(graph, node);
      if (path) {
        const edgeId = path.firstEdge.id;
        const hookId = piiHook?.id;
        problems.push({
          id: `pii_sem_filtro:${node.id}`,
          nodeId: node.id,
          severity: 'erro',
          code: 'pii_sem_filtro',
          message: `Dado PII de ${label} chega ao canal sem filtro`,
          fix: { label: 'Inserir filtro de PII', apply: (g) => insertPiiFilter(g, edgeId, hookId) },
        });
      }
    }
  }

  const hasAgent = graph.nodes.some((n) => n.kind.startsWith('agente.'));
  const hasHuman = graph.nodes.some((n) => n.kind.startsWith('pessoas.'));
  if (ctx.risk === 'autonoma' && hasAgent && !hasHuman) {
    problems.push({
      id: 'autonoma_sem_humano',
      severity: 'aviso',
      code: 'autonoma_sem_humano',
      message: 'Jornada autônoma com agente não tem nenhum ponto de intervenção humana',
    });
  }

  return problems.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'erro' ? -1 : 1));
}

export function blockingProblems(problems: GraphProblem[]): GraphProblem[] {
  return problems.filter((p) => p.severity === 'erro');
}
