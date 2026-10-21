// Construtores compartilhados e montagem do WorkspaceData a partir do conteúdo de cada indústria.
import {
  NODE_KINDS,
  type Approval, type AuditEvent, type BrainArea, type BrainArtifact, type BuildOrder, type Channel,
  type Cockpit, type CockpitKpi, type Component, type ComponentStatus, type ComponentType, type Connector,
  type ConnectorLog, type ConnectorStatus, type ConnectorTool, type ContractField, type DataClassification,
  type DataContract, type DataDomain, type DecisionTable, type DiscoveredField, type DiscoveredObject,
  type EcosystemSystem, type EnvId, type Execution, type IdeConnection, type IndustryId, type Initiative,
  type Journey, type JourneyEdge, type JourneyGraph, type JourneyNode, type KnowledgeCollection,
  type KnowledgeDocument, type KnowledgeGraph, type LakeTable, type LineageNode, type MetricSeries,
  type Policy, type ProfileId, type QualityRule, type RadarItem, type Release, type RetrievalExample,
  type SqlExample, type StepScript, type Suggestion, type SyncMode, type TraceStep, type User,
  type Workspace, type WorkspaceData,
} from '@cortex/schemas';
import {
  CITIES, FIRST_NAMES, LAST_NAMES, cnpj, hashSeed, maskEmail, maskName, maskedCpf, mulberry32, round,
  type Rng,
} from './rng';

// ---------- Tempo da demo ----------
export const SEED_TODAY = '2026-10-21';
const BASE_MS = Date.UTC(2026, 9, 21);
const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

export function dateAgo(days: number): string {
  return new Date(BASE_MS - days * DAY).toISOString().slice(0, 10);
}
/** Data e hora (fuso de Brasília) relativa ao "hoje" da demo. */
export function ts(days: number, h = 10, m = 0): string {
  return `${dateAgo(days)}T${pad(h)}:${pad(m)}:00-03:00`;
}
function weekday(days: number): number {
  return new Date(BASE_MS - days * DAY).getUTCDay();
}

export const PROFILE_ORDER: ProfileId[] = [
  'patrocinador', 'dono_negocio', 'champion', 'engenheiro_ai', 'engenheiro_dados', 'coe', 'seguranca', 'admin',
];

// ---------- Metadados e contexto por indústria ----------
export interface IndustryMeta {
  industry: IndustryId;
  /** Prefixo curto dos ids: sau, var, fin, tel. */
  p: string;
  ws: string;
  seed: number;
  people: Record<ProfileId, string>;
  /** Nome do sistema principal já conectado (para o "MCP do ..."). */
  coreName: string;
  coreConnectorId: string;
  org: string;
  repo: string;
}

export interface Ctx {
  meta: IndustryMeta;
  p: string;
  rng: Rng;
  u: (profile: ProfileId) => string;
  uid: (profile: ProfileId) => string;
}

export function makeCtx(meta: IndustryMeta): Ctx {
  return {
    meta,
    p: meta.p,
    rng: mulberry32(meta.seed),
    u: (pr) => meta.people[pr],
    uid: (pr) => `${meta.p}-u-${pr}`,
  };
}

// ---------- Valores sintéticos para amostras ----------
const PII_GENS = new Set(['nome', 'cpf', 'email', 'telefone', 'nascimento', 'endereco', 'cep', 'hash']);
const COMPANY_KIND = ['Contabilidade', 'Comércio', 'Serviços', 'Engenharia', 'Logística', 'Distribuidora', 'Clínica', 'Padaria'];

/** Campo de amostra: [nome, tipo, gerador]. Geradores PII viram campos marcados como PII. */
export type F = [string, string, string];

export function genValue(gen: string, rng: Rng, i: number): string | number | boolean | null {
  const [kind, a, b] = gen.split(':');
  switch (kind) {
    case 'id': return `${a}${rng.int(100000, 999999)}`;
    case 'seqid': return `${a}${String(Number(b ?? 1) + i).padStart(6, '0')}`;
    case 'nome': return maskName(`${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`);
    case 'empresa': return `${rng.pick(LAST_NAMES)} ${rng.pick(COMPANY_KIND)} ${rng.pick(['ME', 'Ltda', 'EPP'])}`;
    case 'cpf': return maskedCpf(rng);
    case 'cnpj': return cnpj(rng);
    case 'email': return maskEmail(rng.pick(FIRST_NAMES));
    case 'telefone': return `(${rng.pick(['11', '19', '21', '31', '41', '51', '71', '81'])}) 9****-${rng.int(1000, 9999)}`;
    case 'nascimento': return `**/**/${rng.int(1952, 2005)}`;
    case 'endereco': return `${rng.pick(['Rua', 'Av.', 'Alameda'])} ***, ${rng.int(10, 2400)}`;
    case 'cep': return `*****-${rng.int(100, 999)}`;
    case 'hash': return `sha256:${Math.floor(rng.next() * 0xffffffff).toString(16).padStart(8, '0')}`;
    case 'cidade': return rng.pick(CITIES)[0];
    case 'uf': return rng.pick(CITIES)[1];
    case 'data': return dateAgo(rng.int(Number(a ?? 0), Number(b ?? 365)));
    case 'datahora': return ts(rng.int(Number(a ?? 0), Number(b ?? 30)), rng.int(7, 21), rng.int(0, 59));
    case 'valor': return rng.float(Number(a), Number(b), 2);
    case 'int': return rng.int(Number(a), Number(b));
    case 'pct': return rng.float(Number(a), Number(b), 1);
    case 'enum': return rng.pick(a.split('|'));
    case 'seq': { const opts = a.split('|'); return opts[i % opts.length]; }
    case 'bool': return rng.chance(Number(a ?? 0.5));
    case 'const': return a;
    case 'null': return null;
    default: return gen;
  }
}

function sampleRows(fields: F[], rng: Rng, n: number, row0?: Record<string, string | number | boolean | null>) {
  return Array.from({ length: n }, (_, i) => {
    const row: Record<string, string | number | boolean | null> = {};
    for (const [name, , gen] of fields) row[name] = genValue(gen, rng, i);
    return i === 0 && row0 ? { ...row, ...row0 } : row;
  });
}

export function obj(
  ctx: Ctx, name: string, kind: DiscoveredObject['kind'], records: number, fields: F[],
  opts: { rows?: number; row0?: Record<string, string | number | boolean | null> } = {},
): DiscoveredObject {
  const df: DiscoveredField[] = fields.map(([n, t, g]) =>
    PII_GENS.has(g.split(':')[0]) ? { name: n, type: t, pii: true } : { name: n, type: t });
  return { name, kind, records, fields: df, sample: sampleRows(fields, ctx.rng, opts.rows ?? 5, opts.row0) };
}

// ---------- Conectores ----------
export type ToolSpec = [id: string, name: string, description: string, mode: 'leitura' | 'escrita', policyId?: string];

export function tools(specs: ToolSpec[]): ConnectorTool[] {
  return specs.map(([id, name, description, mode, policyId]) => ({
    id, name, description, mode,
    // Tool de escrita nasce desligada para agentes em Prd.
    enabledByEnv: { dev: true, hml: true, prd: mode === 'leitura' },
    ...(policyId ? { policyId } : {}),
  }));
}

export interface ConnSpec {
  id: string;
  typeId: string;
  name: string;
  status?: ConnectorStatus;
  domainId?: string;
  syncMode: SyncMode;
  volume: number;
  latencyMs: number;
  consumers: string[];
  /** Use "{env}" no endereço; em Prd o sufixo de ambiente some. */
  endpoint: string;
  envs?: EnvId[];
  lastSyncMin?: number;
  objects: DiscoveredObject[];
  tools: ToolSpec[];
  logs?: ConnectorLog[];
}

function envEndpoint(tpl: string, env: EnvId) {
  if (env === 'prd') return tpl.replace('-{env}', '').replace('{env}.', '').replace('{env}', 'prd');
  return tpl.replace('{env}', env);
}

export function connector(ctx: Ctx, s: ConnSpec): Connector {
  const status = s.status ?? 'conectado';
  const envs: Connector['envs'] = {};
  for (const env of s.envs ?? (['dev', 'hml', 'prd'] as EnvId[])) {
    envs[env] = { endpoint: envEndpoint(s.endpoint, env), secretRef: `kv://cortex/${ctx.meta.ws}/${s.id}/${env}` };
  }
  const min = s.lastSyncMin ?? ctx.rng.int(3, 50);
  const last = ts(0, 9, Math.max(0, 40 - Math.min(min, 40)));
  const logs: ConnectorLog[] = s.logs ?? [
    { at: ts(6, 8, 12), level: 'info', message: 'Credencial de Prd validada a partir do cofre.' },
    { at: ts(2, 3, 0), level: 'info', message: `Sincronização ${s.syncMode === 'cdc' ? 'contínua (CDC)' : 'agendada'} concluída sem erros.` },
    ...(status === 'degradado'
      ? [
          { at: ts(0, 7, 44), level: 'aviso' as const, message: `Latência p95 acima do limite: ${s.latencyMs} ms (limite 800 ms).` },
          { at: ts(0, 8, 51), level: 'erro' as const, message: 'Timeout em 3 de 120 chamadas na última hora; nova tentativa automática aplicada.' },
        ]
      : [{ at: ts(0, 6, 5), level: 'info' as const, message: 'Teste de saúde: rede, autenticação, permissão e latência ok.' }]),
  ];
  return {
    id: s.id, typeId: s.typeId, name: s.name, status, envs,
    ...(s.domainId ? { domainId: s.domainId } : {}),
    syncMode: s.syncMode, lastSync: last, volume: s.volume, latencyMs: s.latencyMs,
    consumers: s.consumers, objects: s.objects, tools: tools(s.tools), logs,
  };
}

// ---------- Contratos ----------
/** Campo de contrato: [nome, tipo, obrigatório, classificação, descrição, ref?]. */
export type CF = [string, string, boolean, DataClassification, string, string?];

export interface ContractSpec {
  id: string;
  name: string;
  domainId: string;
  entity: string;
  owner: string;
  status?: DataContract['status'];
  fields: CF[];
  /** Campos que só existem na v2. */
  addedInV2?: string[];
  /** Campos da v1 removidos na v2. */
  removedInV2?: CF[];
  v1Note?: string;
  v2Note: string;
  versions?: [string, string];
  freshness: string;
  expectedVolume: string;
  faixa?: [string, string];
  /** Uma regra de qualidade em falha (abre incidente). */
  failing?: boolean;
}

function history(rng: Rng, failing: boolean): number[] {
  const h = Array.from({ length: 10 }, () => rng.float(97, 100, 1));
  if (failing) { h[8] = rng.float(88, 93, 1); h[9] = rng.float(84, 90, 1); }
  return h;
}

export function contract(ctx: Ctx, s: ContractSpec): DataContract {
  const toField = ([name, type, required, classification, description, ref]: CF): ContractField =>
    ({ name, type, required, classification, description, ...(ref ? { ref } : {}) });
  const v2Fields = s.fields.map(toField);
  const v1Fields = [
    ...s.fields.filter((f) => !(s.addedInV2 ?? []).includes(f[0])).map(toField),
    ...(s.removedInV2 ?? []).map(toField),
  ];
  const q = (failing: boolean): QualityRule[] => {
    const rules: QualityRule[] = [];
    const idField = s.fields[0][0];
    const req = s.fields.find((f, i) => i > 0 && f[2]);
    rules.push({ id: `${s.id}-q-unic`, kind: 'unicidade', field: idField, expression: `unique(${idField})`, lastResult: 'ok', history: history(ctx.rng, false) });
    if (req) rules.push({ id: `${s.id}-q-comp`, kind: 'completude', field: req[0], expression: `not_null(${req[0]}) >= 99%`, lastResult: failing ? 'falha' : 'ok', history: history(ctx.rng, failing) });
    if (s.faixa) rules.push({ id: `${s.id}-q-faixa`, kind: 'faixa', field: s.faixa[0], expression: s.faixa[1], lastResult: 'ok', history: history(ctx.rng, false) });
    rules.push({ id: `${s.id}-q-frescor`, kind: 'frescor', expression: `max_age <= ${s.freshness}`, lastResult: 'ok', history: history(ctx.rng, false) });
    rules.push({ id: `${s.id}-q-volume`, kind: 'volume', expression: `row_count ~ ${s.expectedVolume}`, lastResult: 'ok', history: history(ctx.rng, false) });
    return rules;
  };
  const [v1, v2] = s.versions ?? ['1.0.0', '2.0.0'];
  return {
    id: s.id, name: s.name, domainId: s.domainId, entity: s.entity, owner: s.owner, status: s.status ?? 'publicado',
    versions: [
      { version: v1, publishedAt: ts(ctx.rng.int(120, 200), 15, 0), author: ctx.u('engenheiro_dados'), note: s.v1Note ?? 'Primeira versão publicada do contrato.', fields: v1Fields, quality: q(false), freshness: s.freshness, expectedVolume: s.expectedVolume },
      { version: v2, publishedAt: ts(ctx.rng.int(8, 40), 16, 30), author: ctx.u('engenheiro_dados'), note: s.v2Note, fields: v2Fields, quality: q(!!s.failing), freshness: s.freshness, expectedVolume: s.expectedVolume },
    ],
  };
}

// ---------- Lakehouse ----------
export function table(
  ctx: Ctx, id: string, name: string, layer: LakeTable['layer'], domainId: string, rows: number, cols: F[],
  updatedHoursAgo = 2,
): LakeTable {
  const r = ctx.rng;
  const columns = cols.map(([n, t, g]) => {
    const kind = g.split(':')[0];
    const pii = PII_GENS.has(kind);
    const distinct =
      kind === 'id' || kind === 'seqid' || kind === 'cpf' || kind === 'hash' ? rows
      : kind === 'enum' || kind === 'seq' ? g.split(':')[1].split('|').length
      : kind === 'bool' ? 2
      : kind === 'uf' ? 10
      : kind === 'const' ? 1
      : Math.max(2, Math.round(rows * r.float(0.05, 0.9, 2)));
    const nullsPct = layer === 'bronze' ? r.float(0, 4.5, 1) : layer === 'prata' ? r.float(0, 1.2, 1) : r.float(0, 0.3, 1);
    return { name: n, type: t, nullsPct: kind === 'id' || kind === 'seqid' ? 0 : nullsPct, distinct, ...(pii ? { pii: true } : {}) };
  });
  const h = 9 - (updatedHoursAgo % 9);
  return {
    id, name, layer, domainId, rows,
    updatedAt: ts(Math.floor(updatedHoursAgo / 9), h, r.int(0, 59)),
    columns, sample: sampleRows(cols, r, 5),
  };
}

// ---------- Componentes ----------
export interface CompSpec {
  id: string;
  type: ComponentType;
  name: string;
  version: string;
  status: ComponentStatus;
  domainId?: string;
  owner: ProfileId;
  description: string;
  content: string;
  inputs: string[];
  outputs: string[];
  dependencies?: string[];
  packageKind?: 'jornada' | 'esteira';
  log?: [string, number, string][];
}

export function component(ctx: Ctx, s: CompSpec): Component {
  const r = ctx.rng;
  const cases = r.int(18, 64);
  const rate = s.status === 'rascunho' ? r.float(0.55, 0.8) : s.status === 'em_revisao' ? r.float(0.78, 0.92) : r.float(0.9, 1);
  const passed = Math.min(cases, Math.round(cases * rate));
  const log = s.log ?? [[s.version, r.int(5, 60), s.status === 'rascunho' ? 'Rascunho criado a partir do cérebro.' : 'Versão inicial.']];
  const lastDay = log[log.length - 1][1];
  const approvals: Component['approvals'] = [];
  if (['homologado', 'publicado_prd', 'depreciado'].includes(s.status)) {
    approvals.push({ at: ts(Math.max(1, lastDay - 1), 14, 20), by: ctx.u('coe'), profile: 'coe', decision: 'aprovado', note: 'Avaliação acima do mínimo e checagens de segurança ok.' });
  }
  if (s.status === 'publicado_prd') {
    approvals.push({ at: ts(Math.max(0, lastDay - 2), 17, 5), by: ctx.u('dono_negocio'), profile: 'dono_negocio', decision: 'aprovado', note: 'Liberado para jornadas em produção.' });
  }
  if (s.status === 'em_revisao') {
    approvals.push({ at: ts(Math.max(1, lastDay + 3), 11, 0), by: ctx.u('coe'), profile: 'coe', decision: 'reprovado', note: 'Faltam casos de teste para entradas ambíguas; reenviar com a suíte ampliada.' });
  }
  return {
    id: s.id, type: s.type, name: s.name, version: s.version, status: s.status,
    ...(s.domainId ? { domainId: s.domainId } : {}),
    owner: ctx.u(s.owner),
    consumers: s.status === 'rascunho' ? 0 : r.int(2, 24),
    rating: s.status === 'rascunho' ? 0 : r.float(3.8, 4.9, 1),
    description: s.description, content: s.content, inputs: s.inputs, outputs: s.outputs,
    dependencies: s.dependencies ?? [],
    changelog: log.map(([version, d, note]) => ({ version, date: dateAgo(d), note })),
    evaluation: { score: round((passed / cases) * 100, 1), cases, passed },
    approvals,
    ...(s.packageKind ? { packageKind: s.packageKind } : {}),
  };
}

// ---------- Jornadas ----------
export interface NodeSpec {
  id: string;
  kind: string;
  label: string;
  /** Posição em grade: [coluna, linha] (280 px por coluna, 140 px por linha). */
  at: [number, number];
  /** Próximo nó, lista de nós ou mapa saída → nó (nós de decisão). */
  to?: string | string[] | Record<string, string>;
  componentId?: string;
  ruleId?: string;
  contractId?: string;
  toolId?: string;
  channelId?: string;
  emitsPii?: boolean;
  config?: Record<string, string>;
  /** Roteiro do modo demonstração. */
  s: { in: string; out: string; rule?: string; src?: string; tok?: number; ms: number; take?: string };
}

export interface JourneySpec {
  id: string;
  name: string;
  description: string;
  type: Journey['type'];
  domainId: string;
  initiativeId?: string;
  triggerLabel: string;
  risk: Journey['risk'];
  anchor?: boolean;
  brainInputs: string[];
  persona: { name: string; message: string };
  kpis: string[];
  testCases: [string, string, string, ('passou' | 'falhou')?][];
  nodes: NodeSpec[];
  /** Da mais antiga para a mais recente; "drop" remove nós da versão mais recente. */
  versions: { version: string; daysAgo: number; author: ProfileId; note: string; drop?: string[] }[];
  envVersions: Record<EnvId, string | null>;
  /** Roteiro do filtro de PII inserido pelo Studio (jornadas-âncora). */
  piiFilter?: { in: string; out: string };
}

const KIND_DEFS = new Map(NODE_KINDS.map((k) => [k.kind, k]));

function dropNodes(g: JourneyGraph, drop: string[]): JourneyGraph {
  let nodes = g.nodes;
  let edges = g.edges.map((e) => ({ ...e }));
  for (const r of drop) {
    const ins = edges.filter((e) => e.target === r);
    const outs = edges.filter((e) => e.source === r);
    edges = edges.filter((e) => e.source !== r && e.target !== r);
    for (const i of ins) {
      for (const o of outs) {
        if (!edges.some((e) => e.source === i.source && e.target === o.target && e.sourceHandle === i.sourceHandle)) {
          edges.push({ id: '', source: i.source, target: o.target, ...(i.sourceHandle ? { sourceHandle: i.sourceHandle, label: i.label } : {}) });
        }
      }
    }
    nodes = nodes.filter((n) => n.id !== r);
  }
  edges = edges.map((e) => ({ ...e, id: `e-${e.source}-${e.target}${e.sourceHandle ? '-' + e.sourceHandle : ''}` }));
  return { nodes, edges };
}

export function journey(ctx: Ctx, s: JourneySpec, comps: Map<string, Component>): Journey {
  const nodes: JourneyNode[] = s.nodes.map((n) => {
    const def = KIND_DEFS.get(n.kind);
    if (!def) throw new Error(`Tipo de nó desconhecido: ${n.kind}`);
    const comp = n.componentId ? comps.get(n.componentId) : undefined;
    return {
      id: n.id, kind: n.kind, category: def.category, label: n.label,
      position: { x: n.at[0] * 280, y: n.at[1] * 140 },
      ...(n.componentId ? { componentId: n.componentId, componentVersion: comp?.version ?? '0.0.0' } : {}),
      ...(n.ruleId ? { ruleId: n.ruleId } : {}),
      ...(n.contractId ? { contractId: n.contractId } : {}),
      ...(n.toolId ? { toolId: n.toolId } : {}),
      ...(n.channelId ? { channelId: n.channelId } : {}),
      ...(def.outputs ? { outputs: def.outputs } : {}),
      ...(n.emitsPii ? { emitsPii: true } : {}),
      ...(n.config ? { config: n.config } : {}),
    };
  });
  const edges: JourneyEdge[] = [];
  for (const n of s.nodes) {
    if (!n.to) continue;
    if (typeof n.to === 'string' || Array.isArray(n.to)) {
      for (const t of typeof n.to === 'string' ? [n.to] : n.to) edges.push({ id: `e-${n.id}-${t}`, source: n.id, target: t });
    } else {
      for (const [h, t] of Object.entries(n.to)) edges.push({ id: `e-${n.id}-${t}-${h}`, source: n.id, target: t, sourceHandle: h, label: h });
    }
  }
  const full: JourneyGraph = { nodes, edges };
  const script: Record<string, StepScript> = {};
  for (const n of s.nodes) {
    const cat = KIND_DEFS.get(n.kind)!.category;
    const tokens = cat === 'agente' ? n.s.tok ?? 900 : 0;
    const costBRL = cat === 'agente' ? round(tokens * 0.000045, 4) : cat === 'dados' ? 0.002 : 0.0005;
    script[n.id] = {
      input: n.s.in, output: n.s.out,
      ...(n.s.rule ? { rule: n.s.rule } : {}), ...(n.s.src ? { source: n.s.src } : {}),
      tokens, latencyMs: n.s.ms, costBRL,
      ...(n.s.take ? { takeHandle: n.s.take } : {}),
    };
  }
  if (s.piiFilter) {
    script.__pii_filter__ = {
      input: s.piiFilter.in, output: s.piiFilter.out,
      rule: `Hook "Mascarar PII antes de enviar ao canal" v${comps.get(`${ctx.p}-cp-hook-pii`)?.version ?? '1.3.0'}`,
      tokens: 0, latencyMs: 38, costBRL: 0.0004,
    };
  }
  return {
    id: s.id, name: s.name, description: s.description, type: s.type, domainId: s.domainId,
    ...(s.initiativeId ? { initiativeId: s.initiativeId } : {}),
    triggerLabel: s.triggerLabel, risk: s.risk, ...(s.anchor ? { anchor: true } : {}),
    brainInputs: s.brainInputs,
    versions: s.versions.map((v) => ({
      version: v.version, createdAt: ts(v.daysAgo, 15, 10), author: ctx.u(v.author), note: v.note,
      graph: v.drop?.length ? dropNodes(full, v.drop) : full,
    })),
    envVersions: s.envVersions,
    persona: s.persona,
    script,
    testCases: s.testCases.map(([name, input, expected, res], i) => ({ id: `${s.id}-tc${i + 1}`, name, input, expected, ...(res ? { lastResult: res } : {}) })),
    kpis: s.kpis,
  };
}

/** Caminho roteirizado: segue as arestas a partir do gatilho, usando takeHandle nas decisões. */
export function scriptedPath(j: Journey, version?: string): JourneyNode[] {
  const v = j.versions.find((x) => x.version === version) ?? j.versions[j.versions.length - 1];
  const g = v.graph;
  let cur = g.nodes.find((n) => n.category === 'gatilho');
  const path: JourneyNode[] = [];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    path.push(cur);
    seen.add(cur.id);
    const outs = g.edges.filter((e) => e.source === cur!.id);
    if (!outs.length) break;
    const take = j.script[cur.id]?.takeHandle;
    const next = (take && outs.find((e) => e.sourceHandle === take)) || outs[0];
    cur = g.nodes.find((n) => n.id === next.target);
  }
  return path;
}

// ---------- Conteúdo genérico (todas as indústrias) ----------
export const AREAS: { id: string; side: 'negocio' | 'tecnico'; name: string; description: string; owner: ProfileId }[] = [
  { id: 'area-empresa', side: 'negocio', name: 'Empresa', description: 'Estratégia, objetivos, OKRs e processos.', owner: 'patrocinador' },
  { id: 'area-mercado', side: 'negocio', name: 'Mercado', description: 'Benchmark setorial, concorrência e regulação do setor.', owner: 'dono_negocio' },
  { id: 'area-jornadas', side: 'negocio', name: 'Jornadas de cliente', description: 'Clientes, colaboradores e parceiros: etapas, canais, dores e KPIs.', owner: 'dono_negocio' },
  { id: 'area-produtos', side: 'negocio', name: 'Produtos & ofertas', description: 'Portfólio, preços, elegibilidade e canais de venda.', owner: 'dono_negocio' },
  { id: 'area-regras', side: 'negocio', name: 'Regras de negócio', description: 'Políticas, alçadas e exceções em tabelas de decisão.', owner: 'dono_negocio' },
  { id: 'area-arquitetura', side: 'tecnico', name: 'Arquitetura', description: 'Arquiteturas de referência, ADRs e integrações padrão.', owner: 'champion' },
  { id: 'area-dados', side: 'tecnico', name: 'Dados', description: 'Padrões de modelagem, nomenclatura e camadas do lakehouse.', owner: 'engenheiro_dados' },
  { id: 'area-engenharia', side: 'tecnico', name: 'Engenharia', description: 'Stacks aprovadas, convenções de código e componentes reutilizáveis.', owner: 'engenheiro_ai' },
  { id: 'area-devops', side: 'tecnico', name: 'DevOps', description: 'Pipelines, ambientes, estratégia de deploy e rollback.', owner: 'coe' },
  { id: 'area-seguranca', side: 'tecnico', name: 'Segurança', description: 'Controles, LGPD, gestão de segredos e requisitos por classificação.', owner: 'seguranca' },
];

function techArtifacts(ctx: Ctx): BrainArtifact[] {
  const p = ctx.p;
  return [
    { id: `${p}-art-adr-012`, areaId: 'area-arquitetura', kind: 'ADR', title: 'ADR-012 · MCP como camada única de integração para agentes', summary: 'Agentes só acessam sistemas por tools expostas pelo Córtex; nada de chamadas diretas a APIs internas.', body: 'Contexto: cada time integrava sistemas de um jeito. Decisão: toda ação de agente passa por uma tool governada (conector → MCP). Consequências: política única, telemetria por chamada e revogação central.', tags: ['mcp', 'integração', 'aceito'] },
    { id: `${p}-art-adr-015`, areaId: 'area-arquitetura', kind: 'ADR', title: 'ADR-015 · Jornadas como grafo versionado', summary: 'O fluxo da jornada é a fonte da verdade; o código é gerado a partir do grafo e de seus casos de teste.', tags: ['jornadas', 'versionamento', 'aceito'] },
    { id: `${p}-art-ref-rag`, areaId: 'area-arquitetura', kind: 'Arquitetura de referência', title: 'Agente com recuperação e tools', summary: 'Classificar intenção → buscar na base → consultar regra → executar tool → guardrails → responder.', tags: ['referência', 'agente'], metrics: [{ label: 'Jornadas que seguem', value: '9' }] },
    { id: `${p}-art-nomes`, areaId: 'area-dados', kind: 'Padrão', title: 'Nomenclatura do lakehouse', summary: 'Tabelas em snake_case com prefixo da camada: brz_, prt_ e our_. Colunas no singular e datas com sufixo _em.', tags: ['nomenclatura', 'lakehouse'] },
    { id: `${p}-art-camadas`, areaId: 'area-dados', kind: 'Padrão', title: 'Camadas Bronze, Prata e Ouro', summary: 'Bronze guarda o dado como chega; Prata limpa, conforma e trata PII; Ouro publica produtos de dados com contrato.', tags: ['camadas', 'medallion'] },
    { id: `${p}-art-odcs`, areaId: 'area-dados', kind: 'Padrão', title: 'Contratos no padrão ODCS', summary: 'Todo produto de dados em Ouro tem contrato publicado, com dono, classificação de campos e regras de qualidade.', tags: ['contratos', 'odcs'] },
    { id: `${p}-art-stack`, areaId: 'area-engenharia', kind: 'Stack aprovada', title: 'Stack de serviços de jornada', summary: 'TypeScript em Node.js 22, testes com Vitest, contratos validados com Zod e observabilidade com OpenTelemetry.', tags: ['typescript', 'node', 'stack'] },
    { id: `${p}-art-conv`, areaId: 'area-engenharia', kind: 'Convenção', title: 'Convenções de código', summary: 'Um módulo por nó da jornada, nomes em inglês no código e mensagens ao cliente em português vindas do cérebro.', tags: ['convenções', 'revisão'] },
    { id: `${p}-art-reuso`, areaId: 'area-engenharia', kind: 'Padrão', title: 'Reuso antes de construir', summary: 'Antes de criar uma skill ou tool, consultar o catálogo; componentes homologados têm prioridade.', tags: ['catálogo', 'reuso'], componentId: `${p}-cp-skill-resumo` },
    { id: `${p}-art-pipeline`, areaId: 'area-devops', kind: 'Pipeline', title: 'Promoção Dev → Hml → Prd', summary: 'Gates automáticos (testes, componentes homologados, contratos compatíveis) e aprovação humana por ambiente.', tags: ['promoção', 'gates'] },
    { id: `${p}-art-canario`, areaId: 'area-devops', kind: 'Estratégia', title: 'Liberação gradual por canal', summary: 'Nova versão recebe 10%, 50% e 100% do tráfego do canal, com rollback em um clique.', tags: ['deploy', 'rollback'] },
    { id: `${p}-art-lgpd`, areaId: 'area-seguranca', kind: 'Controle', title: 'Controles LGPD por classificação', summary: 'PII mascarada fora de Prd, retenção por finalidade e registro de consentimento antes de contato ativo.', tags: ['lgpd', 'privacidade'], componentId: `${p}-cp-hook-pii` },
    { id: `${p}-art-segredos`, areaId: 'area-seguranca', kind: 'Controle', title: 'Gestão de segredos no cofre', summary: 'Credenciais ficam no cofre e as telas mostram apenas a referência kv://; rotação a cada 90 dias.', tags: ['segredos', 'cofre'] },
  ];
}

export const RADAR: RadarItem[] = [
  { name: 'Recuperação aumentada (RAG) com fonte citada', quadrant: 'tecnicas', ring: 'adotar' },
  { name: 'Contratos de dados (ODCS)', quadrant: 'tecnicas', ring: 'adotar' },
  { name: 'Avaliação contínua de agentes', quadrant: 'tecnicas', ring: 'experimentar' },
  { name: 'Agentes multiagente autônomos em Prd', quadrant: 'tecnicas', ring: 'avaliar' },
  { name: 'Prompts sem versionamento', quadrant: 'tecnicas', ring: 'evitar' },
  { name: 'Model Context Protocol (MCP)', quadrant: 'plataformas', ring: 'adotar' },
  { name: 'Lakehouse com camadas medallion', quadrant: 'plataformas', ring: 'adotar' },
  { name: 'Busca vetorial gerenciada', quadrant: 'plataformas', ring: 'experimentar' },
  { name: 'Modelos hospedados fora do Brasil para dado sensível', quadrant: 'plataformas', ring: 'evitar' },
  { name: 'Claude Code', quadrant: 'ferramentas', ring: 'adotar' },
  { name: 'OpenTelemetry', quadrant: 'ferramentas', ring: 'adotar' },
  { name: 'dbt', quadrant: 'ferramentas', ring: 'experimentar' },
  { name: 'Orquestradores de fluxo sem trilha de auditoria', quadrant: 'ferramentas', ring: 'evitar' },
  { name: 'TypeScript', quadrant: 'linguagens', ring: 'adotar' },
  { name: 'Python para pipelines de dados', quadrant: 'linguagens', ring: 'adotar' },
  { name: 'Rust para serviços de borda', quadrant: 'linguagens', ring: 'avaliar' },
];

function genericComponents(ctx: Ctx): Component[] {
  const p = ctx.p;
  const c = (s: CompSpec) => component(ctx, s);
  return [
    c({ id: `${p}-cp-hook-pii`, type: 'hook', name: 'Mascarar PII antes de enviar ao canal', version: '1.3.0', status: 'publicado_prd', owner: 'seguranca',
      description: 'Intercepta a saída de qualquer nó marcado com PII e mascara CPF, telefone, e-mail e endereço antes da mensagem chegar ao canal.',
      content: 'evento: antes_de_responder_no_canal\nquando: saida.contem_pii == true\nacao:\n  - mascarar: [cpf, telefone, email, endereco]\n  - reduzir_nome: primeiro_nome\n  - registrar_auditoria: guardrail.pii',
      inputs: ['mensagem de saída', 'classificação dos campos'], outputs: ['mensagem mascarada', 'evento de auditoria'],
      log: [['1.0.0', 210, 'Versão inicial com CPF e telefone.'], ['1.2.0', 120, 'Inclui e-mail e endereço.'], ['1.3.0', 45, 'Reduz nome completo ao primeiro nome.']] }),
    c({ id: `${p}-cp-mcp-crm`, type: 'mcp', name: 'MCP do CRM', version: '0.1.0', status: 'rascunho', owner: 'engenheiro_dados',
      description: 'Servidor de tools gerado automaticamente quando o conector do CRM for cadastrado. Aguardando o cadastro no wizard.',
      content: '{\n  "server": "mcp-crm",\n  "origem": "conector CRM (pendente)",\n  "tools": []\n}',
      inputs: ['conector do CRM'], outputs: ['tools de consulta e atualização de cliente'] }),
    c({ id: `${p}-cp-mcp-core`, type: 'mcp', name: `MCP do ${ctx.meta.coreName}`, version: '1.2.0', status: 'publicado_prd', owner: 'engenheiro_dados',
      description: `Tools geradas a partir do conector ${ctx.meta.coreName}, com política de uso por ambiente.`,
      content: `{\n  "server": "mcp-${ctx.meta.coreConnectorId}",\n  "conector": "${ctx.meta.coreConnectorId}",\n  "politica": "escrita desligada em Prd sem política explícita"\n}`,
      inputs: ['credencial por ambiente (cofre)'], outputs: ['tools de leitura e escrita'],
      log: [['1.0.0', 150, 'Gerado pelo conector.'], ['1.1.0', 90, 'Nova tool de leitura.'], ['1.2.0', 30, 'Paginação e timeout de 8 s.']] }),
    c({ id: `${p}-cp-rule-fonte`, type: 'rule', name: 'Responder somente com fonte homologada', version: '1.1.0', status: 'homologado', owner: 'coe',
      description: 'O agente só afirma políticas, prazos e valores quando há trecho recuperado de documento homologado; sem fonte, transfere ou pede mais dados.',
      content: 'SE resposta.cita_politica E NAO resposta.tem_fonte_homologada\nENTAO bloquear_resposta E sugerir_transbordo',
      inputs: ['resposta do agente', 'trechos recuperados'], outputs: ['resposta liberada ou bloqueio'] }),
    c({ id: `${p}-cp-skill-resumo`, type: 'skill', name: 'Resumir conversa para transbordo', version: '2.0.1', status: 'publicado_prd', owner: 'champion',
      description: 'Gera resumo de até 5 linhas para o atendente humano: motivo, dados já confirmados e próximo passo sugerido.',
      content: 'Instruções: resuma a conversa em até 5 linhas. Inclua motivo do contato, dados já validados (sem PII aberta) e o que falta resolver. Não invente informações.',
      inputs: ['histórico da conversa'], outputs: ['resumo para o atendente'],
      log: [['1.0.0', 180, 'Versão inicial.'], ['2.0.0', 60, 'Formato fixo em 5 linhas.'], ['2.0.1', 20, 'Remove PII do resumo.']] }),
    c({ id: `${p}-cp-skill-intencao`, type: 'skill', name: 'Classificar intenção (modelo v1)', version: '1.4.2', status: 'depreciado', owner: 'engenheiro_ai',
      description: 'Classificador de intenção da primeira geração. Substituído pelo nó nativo "Classificar intenção" com taxonomia do cérebro.',
      content: 'Depreciado: use o nó agente.intencao com a taxonomia publicada na área Jornadas de cliente.',
      inputs: ['mensagem do cliente'], outputs: ['intenção', 'confiança'],
      log: [['1.0.0', 300, 'Versão inicial.'], ['1.4.2', 140, 'Última correção antes da depreciação.']] }),
    c({ id: `${p}-cp-hook-consent`, type: 'hook', name: 'Registrar consentimento antes de contato ativo', version: '0.3.0', status: 'em_revisao', owner: 'seguranca',
      description: 'Antes de qualquer mensagem ativa (lembrete, oferta, alerta), verifica e registra o consentimento do cliente para o canal.',
      content: 'evento: antes_de_notificar\nquando: canal in [whatsapp, email, sms]\nacao:\n  - verificar: consentimento.canal == true\n  - senao: bloquear_e_registrar',
      inputs: ['cliente', 'canal'], outputs: ['liberação ou bloqueio'], log: [['0.3.0', 9, 'Enviado para revisão do CoE.']] }),
  ];
}

function genericPolicies(ctx: Ctx): Policy[] {
  const p = ctx.p;
  return [
    { id: `${p}-pol-hml-cpf`, name: 'Hml nunca recebe CPF aberto', kind: 'dado', description: 'Dados pessoais chegam a Hml sempre mascarados ou pseudonimizados.', condition: 'quando um campo classificado como PII for lido em Hml sem máscara', effect: 'bloquear', envs: ['hml'], active: true,
      code: JSON.stringify({ policy: 'hml-sem-cpf-aberto', when: { env: 'hml', field: { classification: 'pii', masked: false } }, then: 'bloquear' }, null, 2) },
    { id: `${p}-pol-escrita-prd`, name: 'Tool de escrita desligada em Prd sem política', kind: 'stack', description: 'Toda tool que cria, altera ou cancela nasce desligada para agentes em Prd até existir política explícita.', condition: 'quando uma jornada em Prd chamar tool de escrita sem política vinculada', effect: 'bloquear', envs: ['prd'], active: true,
      code: JSON.stringify({ policy: 'escrita-prd', when: { env: 'prd', tool: { mode: 'escrita', policyId: null } }, then: 'bloquear' }, null, 2) },
    { id: `${p}-pol-prd-dono`, name: 'Jornada em Prd exige aprovação do dono de negócio', kind: 'jornada', description: 'A promoção de Hml para Prd só acontece com aprovação do CoE AI e do dono de negócio do domínio.', condition: 'quando uma jornada for promovida para Prd', effect: 'exigir_aprovacao', envs: ['prd'], active: true,
      code: JSON.stringify({ policy: 'prd-aprovacao-dono', when: { action: 'promover', to: 'prd' }, then: { exigir_aprovacao: ['coe', 'dono_negocio'] } }, null, 2) },
    { id: `${p}-pol-custo`, name: 'Limite de custo por execução', kind: 'jornada', description: 'Execuções acima de R$ 0,50 geram alerta para o CoE AI.', condition: 'quando o custo de uma execução passar de R$ 0,50', effect: 'alertar', envs: ['dev', 'hml', 'prd'], active: true,
      code: JSON.stringify({ policy: 'limite-custo', when: { execution: { costBRL: { gt: 0.5 } } }, then: 'alertar' }, null, 2) },
  ];
}

// ---------- Conteúdo que cada indústria fornece ----------
export interface IndustryContent {
  workspace: Workspace;
  userDomains: Partial<Record<ProfileId, string[]>>;
  systems: EcosystemSystem[];
  connectors: Connector[];
  channels: Channel[];
  domains: DataDomain[];
  contracts: DataContract[];
  tables: LakeTable[];
  sqlExamples: SqlExample[];
  /** Arestas de linhagem entre ids reais (conector, tabela, contrato, jornada, canal). */
  lineage: [string, string][];
  collections: KnowledgeCollection[];
  documents: KnowledgeDocument[];
  retrievals: RetrievalExample[];
  knowledgeGraph: KnowledgeGraph;
  /** Cobertura (%) na ordem de AREAS. */
  coverage: number[];
  artifacts: BrainArtifact[];
  decisionTables: DecisionTable[];
  components: CompSpec[];
  /** [âncora, jornada em Prd, automação]. */
  journeys: JourneySpec[];
  initiatives: Initiative[];
  policies: Policy[];
  kpis: CockpitKpi[];
  /** Texto do guardrail de destaque do setor (usado em execuções bloqueadas). */
  guardrail: string;
  suggestions: (ws: { journeys: Journey[] }) => Suggestion[];
  /** Escala do volume de execuções diárias nas métricas. */
  dailyVolume: number;
}

// ---------- Derivados ----------
function lineageFrom(content: IndustryContent, journeys: Journey[]) {
  const kindOf = (id: string): [LineageNode['kind'], string] | undefined => {
    const c = content.connectors.find((x) => x.id === id);
    if (c) return ['conector', c.name];
    const t = content.tables.find((x) => x.id === id);
    if (t) return [t.layer, t.name];
    const k = content.contracts.find((x) => x.id === id);
    if (k) return ['contrato', k.name];
    const j = journeys.find((x) => x.id === id);
    if (j) return ['jornada', j.name];
    const ch = content.channels.find((x) => x.id === id);
    if (ch) return ['canal', ch.name];
    return undefined;
  };
  const nodes: LineageNode[] = [];
  const add = (id: string) => {
    if (nodes.some((n) => n.refId === id)) return;
    const k = kindOf(id);
    if (!k) throw new Error(`Linhagem: id inexistente ${id}`);
    nodes.push({ id: `ln-${id}`, label: k[1], kind: k[0], refId: id });
  };
  for (const [a, b] of content.lineage) { add(a); add(b); }
  return { nodes, edges: content.lineage.map(([a, b]) => ({ source: `ln-${a}`, target: `ln-${b}` })) };
}

function releasesFrom(ctx: Ctx, journeys: Journey[], specs: JourneySpec[]): Release[] {
  const out: Release[] = [];
  let n = 1;
  const add = (r: Omit<Release, 'id'>) => out.push({ id: `${ctx.p}-rel-${String(n++).padStart(3, '0')}`, ...r });
  journeys.forEach((j, idx) => {
    const spec = specs[idx];
    const vDays = new Map(spec.versions.map((v) => [v.version, v.daysAgo]));
    const { hml, prd } = j.envVersions;
    if (prd) {
      // Histórico: versões até a de Prd passaram por Hml e Prd.
      let prev: string | undefined;
      for (const v of spec.versions) {
        const d = v.daysAgo;
        add({ journeyId: j.id, from: 'dev', to: 'hml', version: v.version, at: ts(Math.max(2, d - 2), 11, 0), by: ctx.u('champion'), status: 'promovida' });
        if (v.version === prd && prev) {
          // Liberação gradual com um rollback antes da promoção definitiva.
          add({ journeyId: j.id, from: 'hml', to: 'prd', version: v.version, at: ts(Math.max(2, d - 4), 18, 30), by: ctx.u('coe'), status: 'promovida', trafficPct: 10 });
          add({ journeyId: j.id, from: 'hml', to: 'prd', version: prev, at: ts(Math.max(2, d - 5), 9, 10), by: ctx.u('coe'), status: 'rollback', trafficPct: 100 });
          add({ journeyId: j.id, from: 'hml', to: 'prd', version: v.version, at: ts(Math.max(2, d - 8), 18, 0), by: ctx.u('coe'), status: 'promovida', trafficPct: 100 });
        } else {
          add({ journeyId: j.id, from: 'hml', to: 'prd', version: v.version, at: ts(Math.max(2, d - 5), 18, 30), by: ctx.u('coe'), status: 'promovida', trafficPct: 100 });
        }
        prev = v.version;
        if (v.version === prd) break;
      }
      if (hml && hml !== prd) {
        const d = vDays.get(hml) ?? 3;
        add({ journeyId: j.id, from: 'dev', to: 'hml', version: hml, at: ts(Math.max(1, d - 1), 10, 20), by: ctx.u('champion'), status: 'promovida' });
        add({ journeyId: j.id, from: 'hml', to: 'prd', version: hml, at: ts(0, 8, 15), by: ctx.u('champion'), status: 'bloqueada' });
      }
    } else if (hml) {
      add({ journeyId: j.id, from: 'dev', to: 'hml', version: hml, at: ts(Math.max(1, (vDays.get(hml) ?? 4) - 1), 16, 40), by: ctx.u('champion'), status: 'promovida' });
    }
  });
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function buildOrderFrom(ctx: Ctx, anchor: Journey): BuildOrder {
  const v = anchor.versions[anchor.versions.length - 1];
  const slug = anchor.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const fileOf = (kind: string) => kind.split('.')[0];
  return {
    id: `${ctx.p}-oc-0042`, journeyId: anchor.id, journeyVersion: v.version, env: 'dev', status: 'concluida',
    repo: `${ctx.meta.org}/${ctx.meta.repo}`, branch: `cortex/oc-0042-${slug}`, createdAt: ts(2, 14, 5),
    definitionOfDone: [
      'Todos os nós da jornada implementados conforme o grafo',
      'Testes gerados dos casos do Studio passando',
      'validar_contra_padroes sem violações bloqueantes',
      'Filtro de PII aplicado antes de qualquer resposta no canal',
      'PR aberto com evidências anexadas',
    ],
    plan: v.graph.nodes.map((n) => `Implementar "${n.label}" (${n.kind}) em src/${fileOf(n.kind)}/${n.id}.ts`),
    progress: Object.fromEntries(v.graph.nodes.map((n) => [n.id, 'construido' as const])),
    evidences: [
      `${anchor.testCases.length * 4} testes gerados a partir dos casos do Studio: todos passando`,
      'validar_contra_padroes: 0 violações bloqueantes, 2 avisos de nomenclatura corrigidos',
      'Hook "Mascarar PII antes de enviar ao canal" bloqueou uma resposta com CPF aberto; o Claude Code inseriu o filtro e reexecutou',
      'Cobertura de testes: 87% das linhas',
      'Plano aprovado pelo Champion AI no terminal',
    ],
    prUrl: `https://git.exemplo.com.br/${ctx.meta.org}/${ctx.meta.repo}/pull/128`,
    tokens: 412300,
  };
}

function executionsFrom(ctx: Ctx, journeys: Journey[], channels: Channel[], guardrail: string): Execution[] {
  const r = ctx.rng;
  const [anchor, prdJ, auto] = journeys;
  const chOf = (j: Journey) =>
    j.anchor ? channels.find((c) => c.type === 'whatsapp')!.id : (channels.find((c) => Object.values(c.journeyByEnv).includes(j.id)) ?? channels[0]).id;
  const plan: [Journey, EnvId, Execution['result'], boolean][] = [];
  const prdResults: Execution['result'][] = ['sucesso', 'sucesso', 'sucesso', 'transbordo', 'sucesso', 'sucesso', 'erro', 'sucesso', 'transbordo', 'sucesso', 'bloqueado', 'sucesso', 'sucesso', 'transbordo', 'sucesso', 'sucesso'];
  prdResults.forEach((res, i) => plan.push([prdJ, 'prd', res, res === 'sucesso' && (i === 1 || i === 7 || i === 12)]));
  (['sucesso', 'sucesso', 'transbordo', 'sucesso', 'erro', 'sucesso'] as const).forEach((res) => plan.push([anchor, 'dev', res, false]));
  (['sucesso', 'sucesso', 'sucesso', 'erro', 'sucesso', 'sucesso', 'sucesso', 'sucesso'] as const).forEach((res) => plan.push([auto, 'hml', res, false]));

  const execs: Execution[] = plan.map(([j, env, result, piiAlert], i) => {
    const path = scriptedPath(j, j.envVersions[env] ?? undefined);
    let cut = path.length;
    let guard: string | undefined;
    if (result === 'erro') cut = Math.max(1, path.findIndex((n) => n.category === 'dados') + 1) || path.length;
    if (result === 'bloqueado') {
      const idx = path.findIndex((n) => n.category === 'guardrail' || n.category === 'logica');
      cut = idx >= 0 ? idx + 1 : path.length;
      guard = guardrail;
    }
    const steps: TraceStep[] = path.slice(0, cut).map((n, k) => {
      const sc = j.script[n.id];
      const f = r.float(0.8, 1.3, 2);
      const last = k === cut - 1;
      let status: TraceStep['status'] = 'ok';
      let output = sc?.output ?? '';
      if (last && result === 'erro') { status = 'erro'; output = 'Timeout de 8 s no conector; nova tentativa esgotada.'; }
      if (last && result === 'bloqueado') { status = 'bloqueado'; output = `Guardrail acionado: ${guardrail}. Resposta não enviada.`; }
      if (last && result === 'transbordo') { status = 'alerta'; output = 'Cliente pediu atendente; conversa transferida com resumo para a fila humana.'; }
      if (piiAlert && n.kind === 'guardrail.pii') { status = 'alerta'; output = 'CPF e telefone mascarados antes do canal (2 campos).'; guard = 'Filtro de PII: CPF e telefone mascarados antes do canal'; }
      return {
        nodeId: n.id, label: n.label, input: sc?.input ?? '', output,
        ...(sc?.rule ? { rule: sc.rule } : {}), ...(sc?.source ? { source: sc.source } : {}),
        tokens: sc ? Math.round(sc.tokens * f) : 0,
        latencyMs: sc ? Math.round(sc.latencyMs * f) : 0,
        costBRL: sc ? round(sc.costBRL * f, 4) : 0,
        status,
      };
    });
    const day = Math.min(6, Math.floor((i * 7) / plan.length + r.next() * 1.2));
    return {
      id: `${ctx.p}-ex-${String(1000 + i * 37 + r.int(0, 30))}`,
      journeyId: j.id, channel: chOf(j), env, at: ts(day, day === 0 ? r.int(6, 9) : r.int(8, 20), r.int(0, 59)), result,
      latencyMs: steps.reduce((a, s) => a + s.latencyMs, 0),
      tokens: steps.reduce((a, s) => a + s.tokens, 0),
      costBRL: round(steps.reduce((a, s) => a + s.costBRL, 0), 4),
      ...(guard ? { guardrail: guard } : {}),
      steps,
    };
  });
  return execs.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function series(
  ctx: Ctx, id: string, view: MetricSeries['view'], name: string, unit: string, better: 'up' | 'down',
  start: number, end: number, opts: { weekend?: number; noise?: number; decimals?: number; baseline?: number } = {},
): MetricSeries {
  const r = ctx.rng;
  const points = Array.from({ length: 90 }, (_, i) => {
    const days = 89 - i;
    const t = i / 89;
    const dow = weekday(days);
    const weekendF = dow === 0 || dow === 6 ? opts.weekend ?? 1 : 1;
    const base = start + (end - start) * t;
    const v = base * weekendF * (1 + (r.next() - 0.5) * 2 * (opts.noise ?? 0.04));
    return { date: dateAgo(days), value: round(v, opts.decimals ?? 0) };
  });
  return { id: `${ctx.p}-m-${id}`, view, name, unit, points, better, ...(opts.baseline !== undefined ? { baseline: opts.baseline } : {}) };
}

function metricsFrom(ctx: Ctx, content: IndustryContent): MetricSeries[] {
  const v = content.dailyVolume;
  const m: MetricSeries[] = [
    series(ctx, 'execucoes', 'operacao', 'Execuções', 'execuções', 'up', v * 0.55, v, { weekend: 0.62, noise: 0.06 }),
    series(ctx, 'sucesso', 'operacao', 'Taxa de sucesso', '%', 'up', 86, 94.5, { noise: 0.01, decimals: 1 }),
    series(ctx, 'latencia-p95', 'operacao', 'Latência p95', 'ms', 'down', 4200, 2900, { noise: 0.07 }),
    series(ctx, 'transbordos', 'operacao', 'Transbordos', 'transbordos', 'down', v * 0.11, v * 0.06, { weekend: 0.6, noise: 0.1 }),
    series(ctx, 'tokens', 'agentica', 'Tokens', 'tokens', 'down', v * 3100, v * 3600, { weekend: 0.62, noise: 0.06 }),
    series(ctx, 'custo-resolucao', 'agentica', 'Custo por resolução', 'R$', 'down', 0.41, 0.23, { noise: 0.05, decimals: 2 }),
    series(ctx, 'guardrails', 'agentica', 'Guardrails acionados', 'acionamentos', 'down', v * 0.03, v * 0.018, { weekend: 0.6, noise: 0.15 }),
    series(ctx, 'nota-avaliacao', 'agentica', 'Nota de avaliação', 'nota (0–5)', 'up', 3.9, 4.5, { noise: 0.015, decimals: 2 }),
    series(ctx, 'chamadas-mcp', 'engenharia', 'Chamadas MCP', 'chamadas', 'up', 140, 620, { weekend: 0.2, noise: 0.12 }),
    series(ctx, 'linhas-oc', 'engenharia', 'Linhas por OC', 'linhas', 'up', 900, 1650, { weekend: 0.3, noise: 0.12 }),
    series(ctx, 'aderencia', 'engenharia', 'Aderência a padrões', '%', 'up', 71, 93, { noise: 0.015, decimals: 1 }),
    series(ctx, 'frescor', 'dados', 'Frescor', 'h', 'down', 9, 2.5, { noise: 0.1, decimals: 1 }),
    series(ctx, 'qualidade', 'dados', 'Testes de qualidade', '%', 'up', 93, 98.4, { noise: 0.008, decimals: 1 }),
  ];
  content.kpis.forEach((k, i) => {
    const dec = Math.abs(k.current) < 20 ? 1 : 0;
    m.push(series(ctx, `kpi-${i + 1}`, 'negocio', k.name, k.unit, k.better, k.baseline, k.current, { noise: 0.025, decimals: dec, baseline: k.baseline }));
  });
  return m;
}

function approvalsFrom(ctx: Ctx, d: { journeys: Journey[]; components: Component[]; contracts: DataContract[]; decisionTables: DecisionTable[] }): Approval[] {
  const [, prdJ] = d.journeys;
  const revisao = d.components.find((c) => c.status === 'em_revisao')!;
  const cliente = d.contracts[0];
  const rule = d.decisionTables[0].componentId ?? d.components[0].id;
  const ruleComp = d.components.find((c) => c.id === rule)!;
  return [
    { id: `${ctx.p}-ap-1`, kind: 'promocao', title: `Promover "${prdJ.name}" ${prdJ.envVersions.hml} para Prd`, requestedBy: ctx.u('champion'), requestedAt: ts(0, 8, 14), status: 'pendente', approverProfile: 'dono_negocio', objectId: prdJ.id,
      diff: `+ versão ${prdJ.envVersions.hml}: novo nó adicionado ao fluxo\n= contratos compatíveis\n= suíte de testes passando`,
      comments: [{ by: ctx.u('coe'), at: ts(0, 8, 40), text: 'Gates técnicos ok do lado do CoE. Falta a aprovação do dono de negócio.' }] },
    { id: `${ctx.p}-ap-2`, kind: 'componente', title: `Homologar "${revisao.name}" ${revisao.version}`, requestedBy: revisao.owner, requestedAt: ts(3, 10, 30), status: 'ajuste', approverProfile: 'coe', objectId: revisao.id,
      comments: [{ by: ctx.u('coe'), at: ts(2, 16, 2), text: 'Faltam casos de teste para entradas ambíguas.' }] },
    { id: `${ctx.p}-ap-3`, kind: 'contrato', title: `Publicar ${cliente.name} ${cliente.versions[1].version}`, requestedBy: ctx.u('engenheiro_dados'), requestedAt: ts(12, 15, 0), status: 'aprovado', approverProfile: 'coe', objectId: cliente.id,
      diff: cliente.versions[1].note, comments: [{ by: ctx.u('coe'), at: ts(11, 9, 20), text: 'Sem quebra para consumidores em Prd.' }] },
    { id: `${ctx.p}-ap-4`, kind: 'acesso', title: 'Acesso a traces de Prd com PII mascarada', requestedBy: ctx.u('engenheiro_ai'), requestedAt: ts(1, 17, 45), status: 'pendente', approverProfile: 'seguranca', objectId: ctx.uid('engenheiro_ai'),
      comments: [] },
    { id: `${ctx.p}-ap-5`, kind: 'componente', title: `Publicar "${ruleComp.name}" ${ruleComp.version}`, requestedBy: ctx.u('dono_negocio'), requestedAt: ts(6, 11, 10), status: 'aprovado', approverProfile: 'coe', objectId: ruleComp.id,
      comments: [{ by: ctx.u('coe'), at: ts(5, 14, 0), text: 'Casos de teste da tabela cobrem todas as linhas.' }] },
  ];
}

function auditFrom(ctx: Ctx, d: { journeys: Journey[]; components: Component[]; contracts: DataContract[]; connectors: Connector[]; policies: Policy[]; initiatives: Initiative[]; decisionTables: DecisionTable[] }): AuditEvent[] {
  const r = ctx.rng;
  const [anchor, prdJ, auto] = d.journeys;
  const t: [ProfileId, string, string, EnvId][] = [
    ['champion', 'Solicitou promoção para Prd', `${prdJ.name} ${prdJ.envVersions.hml}`, 'prd'],
    ['champion', 'Promoção bloqueada no gate: falta aprovação do dono de negócio', prdJ.name, 'prd'],
    ['champion', 'Promoveu jornada para Hml', `${prdJ.name} ${prdJ.envVersions.hml}`, 'hml'],
    ['engenheiro_ai', 'Salvou nova versão da jornada', `${anchor.name} ${anchor.versions[anchor.versions.length - 1].version}`, 'dev'],
    ['engenheiro_ai', 'Registrou plano da ordem de construção', `${ctx.p.toUpperCase()}-OC-0042`, 'dev'],
    ['engenheiro_ai', 'Abriu PR da ordem de construção', `${ctx.p.toUpperCase()}-OC-0042`, 'dev'],
    ['engenheiro_ai', 'Conectou IDE ao MCP do Córtex', 'Claude Code', 'dev'],
    ['coe', 'Homologou componente', d.components.find((c) => c.status === 'homologado')!.name, 'hml'],
    ['coe', 'Pediu ajuste em componente', d.components.find((c) => c.status === 'em_revisao')!.name, 'dev'],
    ['engenheiro_dados', 'Publicou contrato', `${d.contracts[0].name} ${d.contracts[0].versions[1].version}`, 'dev'],
    ['engenheiro_dados', 'Ressincronizou conector', d.connectors[0].name, 'prd'],
    ['engenheiro_dados', 'Abriu incidente de qualidade', d.contracts[d.contracts.length - 1].name, 'prd'],
    ['dono_negocio', 'Editou tabela de decisão', d.decisionTables[0].name, 'dev'],
    ['dono_negocio', 'Criou iniciativa', d.initiatives[0].title, 'dev'],
    ['patrocinador', 'Decidiu seguir com iniciativa', d.initiatives.find((i) => i.validation?.decision === 'seguir')?.title ?? d.initiatives[1].title, 'dev'],
    ['seguranca', 'Ativou política', d.policies[0].name, 'prd'],
    ['seguranca', 'Revogou credencial antiga', d.connectors[1].name, 'hml'],
    ['seguranca', 'Exportou trilha de auditoria', 'Últimos 30 dias', 'prd'],
    ['admin', 'Adicionou usuário ao workspace', ctx.u('engenheiro_ai'), 'dev'],
    ['champion', 'Rodou suíte de testes', `${auto.name} (${auto.testCases.length} casos)`, 'hml'],
    ['coe', 'Aprovou promoção para Prd', `${prdJ.name} ${prdJ.envVersions.prd}`, 'prd'],
    ['champion', 'Pausou e retomou conector', d.connectors[d.connectors.length - 1].name, 'dev'],
    ['engenheiro_ai', 'Chamou validar_contra_padroes', `${ctx.meta.repo}`, 'dev'],
    ['coe', 'Ajustou limite de custo por execução', 'Limite de custo por execução', 'prd'],
    ['dono_negocio', 'Testou caso na tabela de decisão', d.decisionTables[0].name, 'dev'],
  ];
  const ev = t.map(([profile, action, object, env], i) => {
    const day = Math.min(13, Math.floor(i * 0.55 + r.next() * 1.5));
    return { id: `${ctx.p}-au-${String(i + 1).padStart(3, '0')}`, at: ts(day, day === 0 ? r.int(6, 9) : r.int(8, 19), r.int(0, 59)), actor: ctx.u(profile), profile, action, object, env };
  });
  return ev.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function cockpitFrom(ctx: Ctx, d: { initiatives: Initiative[]; kpis: CockpitKpi[]; coverage: number[]; connectors: Connector[]; approvals: Approval[]; components: Component[] }): [Cockpit, Cockpit] {
  const stages = ['ideia', 'validacao', 'prototipo', 'construcao', 'operacao'] as const;
  const funnel = stages.map((stage) => {
    const xs = d.initiatives.filter((i) => i.stage === stage);
    return { stage, count: xs.length, valueBRL: xs.reduce((a, i) => a + i.expectedValueBRL, 0) };
  });
  const totalValue = funnel.reduce((a, f) => a + f.valueBRL, 0);
  const cov = Math.round(d.coverage.reduce((a, c) => a + c, 0) / d.coverage.length);
  const degr = d.connectors.find((c) => c.status === 'degradado');
  const pend = d.approvals.find((a) => a.status === 'pendente' && a.kind === 'promocao');
  const reused = d.components.filter((c) => c.consumers > 1).length;
  const cockpit: Cockpit = {
    funnel,
    valueKpis: d.kpis,
    adoption: [
      { label: 'Usuários ativos', value: String(ctx.rng.int(70, 140)) },
      { label: 'Devs conectados via MCP', value: String(ctx.rng.int(9, 22)) },
      { label: 'Componentes reutilizados', value: `${reused} de ${d.components.length}` },
      { label: 'Cobertura do cérebro', value: `${cov}%` },
    ],
    engineering: [
      { label: 'Lead time por jornada', before: 54, after: 19, unit: 'dias' },
      { label: 'Custo por jornada entregue', before: 310000, after: 128000, unit: 'R$' },
      { label: 'Homologação na primeira tentativa', before: 38, after: 76, unit: '%' },
      { label: 'Retrabalho em revisão', before: 31, after: 12, unit: '%' },
    ],
    risks: [
      ...(degr ? [{ id: `${ctx.p}-risk-1`, kind: 'conector' as const, title: `Conector "${degr.name}" degradado: latência acima do limite`, severity: 'media' as const }] : []),
      ...(pend ? [{ id: `${ctx.p}-risk-2`, kind: 'aprovacao' as const, title: `${pend.title}: aguardando dono de negócio`, severity: 'media' as const }] : []),
      { id: `${ctx.p}-risk-3`, kind: 'politica', title: 'Jornada em Dev envia dado PII ao WhatsApp sem filtro', severity: 'alta' },
    ],
  };
  const before: Cockpit = {
    funnel: stages.map((stage, i) => ({ stage, count: [9, 3, 1, 1, 1][i], valueBRL: Math.round((totalValue * [0.5, 0.14, 0.04, 0.04, 0.05][i]) / 1000) * 1000 })),
    valueKpis: d.kpis.map((k) => ({ ...k, current: k.baseline })),
    adoption: [
      { label: 'Usuários ativos', value: '12' },
      { label: 'Devs conectados via MCP', value: '0' },
      { label: 'Componentes reutilizados', value: '0' },
      { label: 'Cobertura do cérebro', value: '8%' },
    ],
    engineering: cockpit.engineering.map((e) => ({ ...e, after: e.before })),
    risks: [
      { id: `${ctx.p}-risk-b1`, kind: 'politica', title: 'Sem política de PII nos canais digitais', severity: 'alta' },
      { id: `${ctx.p}-risk-b2`, kind: 'conector', title: 'Integrações ponto a ponto sem monitoramento', severity: 'alta' },
      { id: `${ctx.p}-risk-b3`, kind: 'aprovacao', title: 'Mudanças em produção sem trilha de aprovação', severity: 'media' },
      { id: `${ctx.p}-risk-b4`, kind: 'politica', title: 'Prompts e regras espalhados em planilhas', severity: 'media' },
    ],
  };
  return [cockpit, before];
}

// ---------- Montagem ----------
export function assemble(ctx: Ctx, content: IndustryContent): WorkspaceData {
  const users: User[] = PROFILE_ORDER.map((profile) => ({
    id: ctx.uid(profile), name: ctx.u(profile), profile, domainIds: content.userDomains[profile] ?? [],
  }));
  const components = [...genericComponents(ctx), ...content.components.map((s) => component(ctx, s))];
  const compMap = new Map(components.map((c) => [c.id, c]));
  const journeys = content.journeys.map((s) => journey(ctx, s, compMap));
  const lineage = lineageFrom(content, journeys);
  const brainAreas: BrainArea[] = AREAS.map((a, i) => ({
    id: a.id, side: a.side, name: a.name, description: a.description, owner: ctx.u(a.owner),
    updatedAt: ts(ctx.rng.int(0, 20), ctx.rng.int(9, 18), ctx.rng.int(0, 59)), coverage: content.coverage[i],
  }));
  const policies = [...genericPolicies(ctx), ...content.policies];
  const ideConnections: IdeConnection[] = [
    { id: `${ctx.p}-ide-1`, ide: 'claude_code', userId: ctx.uid('engenheiro_ai'), project: ctx.meta.repo, env: 'dev', connectedAt: ts(9, 10, 12), lastCallAt: ts(0, 9, 31),
      tools: ['obter_ordem', 'buscar_regra', 'obter_contrato', 'listar_componentes', 'consultar_conhecimento', 'validar_contra_padroes', 'registrar_plano', 'registrar_progresso', 'registrar_evidencia', 'propor_mudanca'] },
    { id: `${ctx.p}-ide-2`, ide: 'cursor', userId: ctx.uid('champion'), project: ctx.meta.repo, env: 'dev', connectedAt: ts(5, 15, 48), lastCallAt: ts(1, 17, 3),
      tools: ['buscar_regra', 'obter_contrato', 'listar_componentes', 'consultar_conhecimento', 'validar_contra_padroes'] },
  ];
  const releases = releasesFrom(ctx, journeys, content.journeys);
  const buildOrders = [buildOrderFrom(ctx, journeys[0])];
  const approvals = approvalsFrom(ctx, { journeys, components, contracts: content.contracts, decisionTables: content.decisionTables });
  const audit = auditFrom(ctx, { journeys, components, contracts: content.contracts, connectors: content.connectors, policies, initiatives: content.initiatives, decisionTables: content.decisionTables });
  const executions = executionsFrom(ctx, journeys, content.channels, content.guardrail);
  const metrics = metricsFrom(ctx, content);
  const [cockpit, cockpitBefore] = cockpitFrom(ctx, { initiatives: content.initiatives, kpis: content.kpis, coverage: content.coverage, connectors: content.connectors, approvals, components });
  return {
    workspace: content.workspace,
    users,
    systems: content.systems,
    connectors: content.connectors,
    channels: content.channels,
    ideConnections,
    domains: content.domains,
    contracts: content.contracts,
    tables: content.tables,
    sqlExamples: content.sqlExamples,
    lineage,
    collections: content.collections,
    documents: content.documents,
    retrievals: content.retrievals,
    knowledgeGraph: content.knowledgeGraph,
    brainAreas,
    artifacts: [...content.artifacts, ...techArtifacts(ctx)],
    radar: RADAR,
    decisionTables: content.decisionTables,
    components,
    journeys,
    releases,
    initiatives: content.initiatives,
    buildOrders,
    policies,
    approvals,
    audit,
    executions,
    metrics,
    suggestions: content.suggestions({ journeys }),
    cockpit,
    cockpitBefore,
  };
}

export { hashSeed };
