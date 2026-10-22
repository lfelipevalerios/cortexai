// Ponte entre o editor visual ("quando [condição] então [efeito]") e Policy.code (JSON).
import type { Policy, Execution, WorkspaceData } from '@cortex/schemas';
import { describePolicy, type PolicyOp } from '@cortex/engine';

export const OPS: { value: PolicyOp; label: string }[] = [
  { value: 'eq', label: 'é' },
  { value: 'neq', label: 'não é' },
  { value: 'gt', label: 'é maior que' },
  { value: 'gte', label: 'é maior ou igual a' },
  { value: 'lt', label: 'é menor que' },
  { value: 'lte', label: 'é menor ou igual a' },
  { value: 'in', label: 'está entre' },
  { value: 'contains', label: 'contém' },
];
const OP_SET = new Set(OPS.map((o) => o.value as string));

/** Campos que o motor entende (PolicySubject). */
export const FIELDS: { value: string; label: string }[] = [
  { value: 'env', label: 'Ambiente' },
  { value: 'risk', label: 'Risco da jornada' },
  { value: 'journeyType', label: 'Tipo da jornada' },
  { value: 'dataClassifications', label: 'Classificação do dado' },
  { value: 'amountBRL', label: 'Valor (R$)' },
  { value: 'costBRL', label: 'Custo por execução (R$)' },
  { value: 'writeToolsWithoutPolicy', label: 'Tools de escrita sem política' },
  { value: 'hasOwnerApproval', label: 'Aprovação do dono de negócio' },
  { value: 'hasHumanNode', label: 'Intervenção humana' },
  { value: 'modelRegion', label: 'Região do modelo' },
  { value: 'evaluationScore', label: 'Nota de avaliação' },
];

export interface CondRow {
  id: string;
  field: string;
  op: PolicyOp;
  value: string;
}

let seq = 1;
export const newRowId = () => `c${Date.now().toString(36)}${seq++}`;

function isOpMap(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some((k) => OP_SET.has(k));
}

function valueToText(v: unknown): string {
  if (Array.isArray(v)) return v.map(valueToText).join(', ');
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return String(v);
}

function textToScalar(t: string): string | number | boolean | null {
  const s = t.trim();
  if (s === 'null') return null;
  if (/^(sim|true)$/i.test(s)) return true;
  if (/^(não|nao|false)$/i.test(s)) return false;
  if (s !== '' && !Number.isNaN(Number(s.replace(',', '.'))) && /^-?[\d.,]+$/.test(s)) return Number(s.replace(',', '.'));
  return s;
}

function textToValue(t: string): unknown {
  if (t.includes(',') && !/^-?\d+,\d+$/.test(t.trim())) return t.split(',').map((x) => textToScalar(x)).filter((x) => x !== '');
  return textToScalar(t);
}

export interface ParsedCode {
  rows: CondRow[];
  effect: Policy['effect'] | null;
  meta: Record<string, unknown>;
}

/** Lê o JSON da política em linhas do editor. Objetos aninhados viram campos com ponto (ex.: "tool.mode"). */
export function codeToRows(code: string): ParsedCode | null {
  let raw: unknown;
  try {
    raw = JSON.parse(code);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const when = r.when;
  if (!when || typeof when !== 'object' || Array.isArray(when)) return null;
  const rows: CondRow[] = [];
  const walk = (prefix: string, obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (isOpMap(v)) {
        for (const [op, val] of Object.entries(v)) {
          if (OP_SET.has(op)) rows.push({ id: newRowId(), field: key, op: op as PolicyOp, value: valueToText(val) });
        }
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        walk(key, v as Record<string, unknown>);
      } else {
        rows.push({ id: newRowId(), field: key, op: 'eq', value: valueToText(v) });
      }
    }
  };
  walk('', when as Record<string, unknown>);
  let effect: Policy['effect'] | null = null;
  if (r.then === 'bloquear' || r.then === 'exigir_aprovacao' || r.then === 'alertar') effect = r.then;
  else if (r.then && typeof r.then === 'object') {
    const k = Object.keys(r.then)[0];
    if (k === 'bloquear' || k === 'exigir_aprovacao' || k === 'alertar') effect = k;
  }
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (k !== 'when' && k !== 'then') meta[k] = v;
  return { rows, effect, meta };
}

/** Monta o JSON a partir das linhas do editor (campos com ponto voltam a ser objetos aninhados). */
export function rowsToCode(rows: CondRow[], effect: Policy['effect'], meta: Record<string, unknown>): string {
  const when: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.field.trim()) continue;
    const path = row.field.trim().split('.');
    let cur = when;
    for (let i = 0; i < path.length - 1; i++) {
      const next = cur[path[i]];
      if (!next || typeof next !== 'object' || Array.isArray(next)) cur[path[i]] = {};
      cur = cur[path[i]] as Record<string, unknown>;
    }
    const leaf = path[path.length - 1];
    const val = textToValue(row.value);
    if (row.op === 'eq' && !(leaf in cur)) cur[leaf] = val;
    else {
      const prev = cur[leaf];
      const map: Record<string, unknown> = isOpMap(prev) ? { ...prev } : prev !== undefined ? { eq: prev } : {};
      map[row.op] = val;
      cur[leaf] = map;
    }
  }
  const { message, ...rest } = meta;
  return JSON.stringify({ ...rest, when, then: effect, ...(message !== undefined ? { message } : {}) }, null, 2);
}

/** "quando … então …" pelo motor, com os campos aninhados achatados para leitura. */
export function describeCode(code: string, fallbackEffect: Policy['effect']): string {
  const parsed = codeToRows(code);
  if (!parsed) return 'regra inválida: o JSON não pôde ser lido';
  return describePolicy(rowsToFlatCode(parsed.rows, parsed.effect ?? fallbackEffect));
}

function rowsToFlatCode(rows: CondRow[], effect: Policy['effect']): string {
  const when: Record<string, Record<string, unknown>> = {};
  for (const r of rows) {
    when[r.field] = { ...(when[r.field] ?? {}), [r.op]: textToValue(r.value) };
  }
  return JSON.stringify({ when, then: effect });
}

// ---------- Onde a política aparece ----------
export interface PolicyReach {
  studio: number;
  promocao: number;
  construcao: number;
  execucao: number;
}

function executionMatches(p: Policy, e: Execution, costLimit: number | null): boolean {
  if (!p.envs.includes(e.env)) return false;
  if (e.guardrail) {
    const g = e.guardrail.toLowerCase();
    if (g.startsWith(p.name.toLowerCase())) return true;
    if (p.kind === 'dado' && /pii|cpf/.test(g) && /pii|cpf|pessoa/i.test(p.name + p.description)) return true;
  }
  if (costLimit !== null && e.costBRL > costLimit) return true;
  return false;
}

/** Contagens por ponto de aplicação, derivadas dos dados do workspace. */
export function policyReach(p: Policy, ws: WorkspaceData): PolicyReach {
  const toolPolicy = new Map<string, string | undefined>();
  ws.connectors.forEach((c) => c.tools.forEach((t) => toolPolicy.set(t.id, t.policyId)));
  const text = `${p.name} ${p.description} ${p.condition}`.toLowerCase();
  let studio = 0;
  for (const j of ws.journeys) {
    const v = j.versions[j.versions.length - 1];
    for (const n of v.graph.nodes) {
      if (n.toolId && toolPolicy.get(n.toolId) === p.id) studio++;
      else if (p.kind === 'dado' && (n.kind === 'guardrail.pii' || n.emitsPii) && /pii|cpf|pessoa|mascar/.test(text)) studio++;
      else if (p.kind === 'jornada' && p.effect === 'exigir_aprovacao' && n.kind === 'pessoas.aprovacao') studio++;
      else if (p.kind === 'jornada' && /custo/.test(text) && n.kind === 'guardrail.custo') studio++;
      else if (n.componentId && p.code.includes(n.componentId)) studio++;
      else if (p.kind === 'stack' && /modelo/.test(text) && n.category === 'agente') studio++;
    }
  }
  const promoEnvs: string[] = p.envs.filter((e) => e !== 'dev');
  const promocao = ws.releases.filter((r) => promoEnvs.includes(r.to)).length
    + ws.approvals.filter((a) => a.kind === 'promocao' && p.effect === 'exigir_aprovacao' && /aprova|prd/.test(text)).length;
  const construcao = p.active ? ws.buildOrders.filter((o) => p.envs.includes(o.env) || p.kind !== 'jornada').length : 0;
  let costLimit: number | null = null;
  const parsed = codeToRows(p.code);
  const costRow = parsed?.rows.find((r) => /costBRL$/.test(r.field) && (r.op === 'gt' || r.op === 'gte'));
  if (costRow) costLimit = Number(costRow.value.replace(',', '.'));
  const execucao = ws.executions.filter((e) => executionMatches(p, e, costLimit)).length;
  return { studio, promocao, construcao, execucao };
}
