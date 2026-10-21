// Estado em memória do servidor MCP: os 4 workspaces gerados pelo seed,
// mutados pelas ferramentas de escrita, mais o log de eventos e a telemetria.
import { randomUUID } from 'node:crypto';
import type { EnvId, WorkspaceData } from '@cortex/schemas';
import { generateWorkspaces } from '@cortex/seed';

export interface Scope {
  workspaceId: string;
  env: EnvId;
  project: string;
  /** Token anônimo (CORTEX_ALLOW_ANON=1). */
  anonymous?: boolean;
}

export type EventKind = 'telemetria' | 'escrita';

export interface CortexEvent {
  id: string;
  at: string;
  kind: EventKind;
  /** Ferramenta, recurso ou prompt chamado. */
  tool: string;
  workspaceId: string;
  env: EnvId;
  project: string;
  /** Resultado da chamada (telemetria) ou objeto alterado (escrita). */
  ok?: boolean;
  durationMs?: number;
  object?: string;
  detail?: string;
}

/** História criada no ITSM simulado (não existe no modelo do seed). */
export interface ItsmStory {
  key: string;
  workspaceId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'baixa' | 'media' | 'alta';
  buildOrderId?: string;
  journeyId?: string;
  createdAt: string;
  createdBy: string;
}

function loadWorkspaces(): WorkspaceData[] {
  try {
    const data = generateWorkspaces();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[cortex-mcp] falha ao gerar workspaces do seed:', err);
    return [];
  }
}

const workspaces = new Map<string, WorkspaceData>();
for (const ws of loadWorkspaces()) workspaces.set(ws.workspace.id, ws);
/** Ids vindos do seed (os vazios criados sob demanda por wsOf não contam). */
const seededIds = new Set(workspaces.keys());

const events: CortexEvent[] = [];
const itsmStories: ItsmStory[] = [];
const MAX_EVENTS = 5000;

export const store = {
  workspaceIds(): string[] {
    return [...seededIds];
  },
  isEmpty(): boolean {
    return seededIds.size === 0;
  },
  get(workspaceId: string): WorkspaceData | undefined {
    return workspaces.get(workspaceId);
  },
  events(filter?: { workspaceId?: string; kind?: EventKind; since?: string; limit?: number }): CortexEvent[] {
    let list = events;
    if (filter?.workspaceId) list = list.filter((e) => e.workspaceId === filter.workspaceId);
    if (filter?.kind) list = list.filter((e) => e.kind === filter.kind);
    if (filter?.since) list = list.filter((e) => e.at > filter.since!);
    const limit = filter?.limit ?? 200;
    return list.slice(-limit);
  },
  record(ev: Omit<CortexEvent, 'id' | 'at'>): CortexEvent {
    const full: CortexEvent = { id: randomUUID(), at: new Date().toISOString(), ...ev };
    events.push(full);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    return full;
  },
  addStory(story: Omit<ItsmStory, 'key'>): ItsmStory {
    const key = `CTX-${1000 + itsmStories.length + 1}`;
    const full = { key, ...story };
    itsmStories.push(full);
    return full;
  },
  stories(workspaceId: string): ItsmStory[] {
    return itsmStories.filter((s) => s.workspaceId === workspaceId);
  },
};

/** Workspace vazio usado quando o seed ainda não tem dados para o escopo do token. */
export function emptyWorkspace(id: string): WorkspaceData {
  const emptyCockpit = { funnel: [], valueKpis: [], adoption: [], engineering: [], risks: [] };
  return {
    workspace: { id, industry: 'telecom', company: id, segment: '', tagline: '', description: '' },
    users: [], systems: [], connectors: [], channels: [], ideConnections: [], domains: [],
    contracts: [], tables: [], sqlExamples: [], lineage: { nodes: [], edges: [] },
    collections: [], documents: [], retrievals: [], knowledgeGraph: { nodes: [], edges: [] },
    brainAreas: [], artifacts: [], radar: [], decisionTables: [], components: [], journeys: [],
    releases: [], initiatives: [], buildOrders: [], policies: [], approvals: [], audit: [],
    executions: [], metrics: [], suggestions: [], cockpit: emptyCockpit, cockpitBefore: emptyCockpit,
  };
}

/** Dados do workspace do escopo; nunca lança, mesmo com seed vazio. */
export function wsOf(scope: Scope): WorkspaceData {
  let ws = workspaces.get(scope.workspaceId);
  if (!ws) {
    ws = emptyWorkspace(scope.workspaceId);
    workspaces.set(scope.workspaceId, ws);
  }
  return ws;
}

// ---------- utilidades de texto ----------
const STOPWORDS = new Set(
  'a o as os um uma uns umas de da do das dos em no na nos nas por para pra com sem que qual quais como quando onde e ou se ao aos the and for with of to in is are ser sao foi tem ter mais menos muito pelo pela pelos pelas sobre entre este esta isso esse essa seu sua seus suas meu minha'.split(' '),
);

export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Pontuação simples: termos da consulta presentes no texto, com bônus no título. */
export function score(query: string, text: string, title = ''): number {
  const q = [...new Set(tokens(query))];
  if (q.length === 0) return 0;
  const body = norm(text);
  const head = norm(title);
  let s = 0;
  for (const t of q) {
    // prefixo de 5 letras pega plurais e flexões simples (fatura/faturas, cobrar/cobrança)
    const stem = t.length > 5 ? t.slice(0, 5) : t;
    if (head.includes(stem)) s += 3;
    if (body.includes(stem)) s += 1;
  }
  return s / q.length;
}

export function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function bumpVersion(v: string | undefined): string {
  if (!v) return '0.1';
  const parts = v.split('.');
  const last = Number(parts[parts.length - 1]);
  if (Number.isNaN(last)) return `${v}.1`;
  parts[parts.length - 1] = String(last + 1);
  return parts.join('.');
}
