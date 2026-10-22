// Utilitários do Studio: versões, ids, caminhos de PII e ordem de construção.
import type {
  BuildOrder, Channel, EnvId, Journey, JourneyGraph, JourneyNode, JourneyTestCase, Release, WorkspaceData,
} from '@cortex/schemas';
import { validateGraph } from '@cortex/engine';

/** Prefixo da indústria a partir de um id ("tel-jr-x" → "tel"). */
export function prefixOf(id: string): string {
  return id.split('-')[0] || 'cx';
}

function parseVersion(v: string): [number, number, number] {
  const [a, b, c] = v.split('.').map((x) => Number.parseInt(x, 10) || 0);
  return [a ?? 0, b ?? 0, c ?? 0];
}

export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** Próxima versão minor a partir da maior versão da jornada. */
export function nextMinor(journey: Journey): string {
  const latest = journey.versions.map((v) => v.version).sort(compareVersions).pop() ?? '0.0.0';
  const [a, b] = parseVersion(latest);
  return `${a}.${b + 1}.0`;
}

export function sameGraph(a: JourneyGraph | undefined, b: JourneyGraph | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function cloneGraph(g: JourneyGraph): JourneyGraph {
  return structuredClone(g);
}

export function isChannelSink(n: JourneyNode): boolean {
  return n.category !== 'gatilho' && (n.kind === 'saida.responder' || !!n.channelId);
}

/** Nós de canal alcançados por dado PII sem passar por filtro (destino do bloqueio no teste). */
export function unfilteredPiiSinks(graph: JourneyGraph): Set<string> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const sinks = new Set<string>();
  for (const emitter of graph.nodes.filter((n) => n.emitsPii)) {
    const seen = new Set<string>([emitter.id]);
    const stack = graph.edges.filter((e) => e.source === emitter.id).map((e) => e.target);
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const n = byId.get(id);
      if (!n || n.kind === 'guardrail.pii') continue;
      if (isChannelSink(n)) {
        sinks.add(n.id);
        continue;
      }
      for (const e of graph.edges) if (e.source === id) stack.push(e.target);
    }
  }
  return sinks;
}

const CHANNEL_LABEL: Partial<Record<Channel['type'], string>> = {
  whatsapp: 'WhatsApp', webchat: 'chat do site', app: 'app', email: 'e-mail', voz: 'canal de voz', teams: 'Teams',
};

export function channelLabel(data: WorkspaceData, node: JourneyNode | undefined): string {
  const ch = node?.channelId ? data.channels.find((c) => c.id === node.channelId) : undefined;
  if (!ch) return 'canal';
  return CHANNEL_LABEL[ch.type] ?? ch.name;
}

/** Ordem de construção/execução: BFS a partir dos gatilhos; nós soltos ao final. */
export function buildOrderOf(graph: JourneyGraph): JourneyNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const start = graph.nodes.filter((n) => n.category === 'gatilho');
  const queue = (start.length ? start : graph.nodes.slice(0, 1)).map((n) => n.id);
  const seen = new Set<string>();
  const out: JourneyNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = byId.get(id);
    if (!n) continue;
    out.push(n);
    for (const e of graph.edges) if (e.source === id) queue.push(e.target);
  }
  for (const n of graph.nodes) if (!seen.has(n.id)) out.push(n);
  return out;
}

/** Resultado de um caso da suíte: passa se o grafo não tem problema bloqueante nem PII sem filtro. */
export function suiteResult(graph: JourneyGraph, data: WorkspaceData, env: EnvId, journey: Journey): 'passou' | 'falhou' {
  const errors = validateGraph(graph, { data, env, risk: journey.risk }).filter((p) => p.severity === 'erro');
  return errors.length === 0 && unfilteredPiiSinks(graph).size === 0 ? 'passou' : 'falhou';
}

export function runSuiteOn(cases: JourneyTestCase[], result: 'passou' | 'falhou'): JourneyTestCase[] {
  return cases.map((c) => ({ ...c, lastResult: result }));
}

export function nextReleaseId(data: WorkspaceData, p: string): string {
  const ids = new Set(data.releases.map((r) => r.id));
  let n = data.releases.length + 1;
  while (ids.has(`${p}-rel-${String(n).padStart(3, '0')}`)) n++;
  return `${p}-rel-${String(n).padStart(3, '0')}`;
}

export function nextApprovalId(data: WorkspaceData, p: string): string {
  const ids = new Set(data.approvals.map((a) => a.id));
  let n = data.approvals.length + 1;
  while (ids.has(`${p}-ap-${n}`)) n++;
  return `${p}-ap-${n}`;
}

export function nextBuildOrderId(data: WorkspaceData, p: string): string {
  let max = 0;
  for (const o of data.buildOrders) {
    const m = /-oc-(\d+)$/.exec(o.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${p}-oc-${String(max + 1).padStart(4, '0')}`;
}

export function slugify(s: string, max = 40): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

export function prdObjectId(journeyId: string, version: string): string {
  return `${journeyId}@${version}->prd`;
}

export function userName(data: WorkspaceData, profile: string): string {
  return data.users.find((u) => u.profile === profile)?.name ?? 'Usuário da demo';
}

export const OC_STATUS: Record<BuildOrder['status'], { label: string; status: string }> = {
  na_fila: { label: 'Na fila', status: 'pendente' },
  plano_registrado: { label: 'Plano registrado', status: 'em_revisao' },
  em_construcao: { label: 'Em construção', status: 'sincronizando' },
  pronta_revisao: { label: 'Pronta para revisão', status: 'homologado' },
  concluida: { label: 'Concluída', status: 'aprovado' },
};

export const RELEASE_STATUS: Record<Release['status'], string> = {
  promovida: 'aprovado',
  bloqueada: 'bloqueado',
  rollback: 'ajuste',
};

export const RISK_LABEL: Record<Journey['risk'], string> = {
  assistida: 'Assistida',
  supervisionada: 'Supervisionada',
  autonoma: 'Autônoma',
};

export function formatDateTime(iso: string): string {
  const d = iso.slice(0, 10).split('-');
  const t = iso.slice(11, 16);
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}${t ? ` ${t}` : ''}` : iso;
}

/** Custo com 4 casas (custos por passo são frações de centavo). */
export function brl4(n: number): string {
  return `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n)}`;
}
