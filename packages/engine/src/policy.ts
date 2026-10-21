// Motor de políticas: regras em JSON avaliadas no desenho, na promoção e na execução.
//
// Formato do campo Policy.code:
//   { "when": { "<campo>": <valor> | { "<op>": <valor> }, ... },
//     "then": "bloquear" | "exigir_aprovacao" | "alertar",
//     "message"?: "texto opcional" }
// Todas as condições de "when" precisam ser verdadeiras (E lógico).
// Operadores: eq, neq, gt, gte, lt, lte, in, contains. Valor sem operador = eq.
// Em campos lista, eq/contains testam pertinência e gt/gte/lt/lte comparam o tamanho.
import type { DataClassification, EnvId, Journey, Policy } from '@cortex/schemas';
import { formatNumber } from './format';

export type PolicyEffect = Policy['effect'];
export type PolicyOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
export type PolicyScalar = string | number | boolean;
export type PolicyOperand = PolicyScalar | PolicyScalar[];
export type PolicyCondition = PolicyOperand | Partial<Record<PolicyOp, PolicyOperand>>;

export interface PolicyRule {
  when: Record<string, PolicyCondition>;
  then?: PolicyEffect;
  message?: string;
  /** Nota mínima de avaliação exigida (usada no gate de Prd). */
  minEvaluationScore?: number;
}

export interface PolicySubject {
  env: EnvId;
  risk?: Journey['risk'];
  journeyType?: Journey['type'];
  dataClassifications?: DataClassification[];
  amountBRL?: number;
  costBRL?: number;
  writeToolsWithoutPolicy?: string[];
  hasOwnerApproval?: boolean;
  hasHumanNode?: boolean;
  modelRegion?: string;
  evaluationScore?: number;
  [field: string]: unknown;
}

export interface PolicyHit {
  policyId: string;
  policyName: string;
  effect: PolicyEffect;
  message: string;
}

const OPS: PolicyOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'];
const EFFECTS: PolicyEffect[] = ['bloquear', 'exigir_aprovacao', 'alertar'];

export function parsePolicyCode(code: string): PolicyRule | null {
  try {
    const raw = JSON.parse(code) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (!r.when || typeof r.when !== 'object' || Array.isArray(r.when)) return null;
    const rule: PolicyRule = { when: r.when as Record<string, PolicyCondition> };
    if (typeof r.then === 'string' && EFFECTS.includes(r.then as PolicyEffect)) rule.then = r.then as PolicyEffect;
    if (typeof r.message === 'string') rule.message = r.message;
    if (typeof r.minEvaluationScore === 'number') rule.minEvaluationScore = r.minEvaluationScore;
    return rule;
  } catch {
    return null;
  }
}

function isOpMap(c: PolicyCondition): c is Partial<Record<PolicyOp, PolicyOperand>> {
  return !!c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).some((k) => OPS.includes(k as PolicyOp));
}

function scalarEq(a: unknown, b: PolicyScalar): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

function toNum(v: unknown): number | null {
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function applyOp(op: PolicyOp, actual: unknown, operand: PolicyOperand): boolean {
  if (actual === undefined || actual === null) return op === 'neq';
  const list = Array.isArray(operand) ? operand : [operand];
  switch (op) {
    case 'eq':
      return Array.isArray(actual) ? list.some((v) => actual.some((a) => scalarEq(a, v))) : list.some((v) => scalarEq(actual, v));
    case 'neq':
      return !applyOp('eq', actual, operand);
    case 'in':
      return Array.isArray(actual) ? actual.some((a) => list.some((v) => scalarEq(a, v))) : list.some((v) => scalarEq(actual, v));
    case 'contains':
      if (Array.isArray(actual)) return list.every((v) => actual.some((a) => scalarEq(a, v)));
      if (typeof actual === 'string') return list.every((v) => actual.toLowerCase().includes(String(v).toLowerCase()));
      return false;
    default: {
      const a = toNum(actual);
      const b = toNum(Array.isArray(operand) ? operand[0] : operand);
      if (a === null || b === null) return false;
      if (op === 'gt') return a > b;
      if (op === 'gte') return a >= b;
      if (op === 'lt') return a < b;
      return a <= b;
    }
  }
}

export function ruleMatches(rule: PolicyRule, subject: PolicySubject): boolean {
  return Object.entries(rule.when).every(([field, cond]) => {
    const actual = subject[field];
    if (isOpMap(cond)) {
      return (Object.entries(cond) as [PolicyOp, PolicyOperand][]).every(([op, v]) => (OPS.includes(op) ? applyOp(op, actual, v) : true));
    }
    return applyOp('eq', actual, cond as PolicyOperand);
  });
}

/** Avalia as políticas ativas do ambiente contra o sujeito. JSON inválido não dispara. */
export function evaluatePolicies(policies: Policy[], subject: PolicySubject): PolicyHit[] {
  const hits: PolicyHit[] = [];
  for (const p of policies) {
    if (!p.active || !p.envs.includes(subject.env)) continue;
    const rule = parsePolicyCode(p.code);
    if (!rule || Object.keys(rule.when).length === 0) continue;
    if (!ruleMatches(rule, subject)) continue;
    hits.push({
      policyId: p.id,
      policyName: p.name,
      effect: rule.then ?? p.effect,
      message: rule.message ?? `${p.name}: ${describePolicy(p.code)}`,
    });
  }
  return hits;
}

const FIELD_LABELS: Record<string, string> = {
  env: 'o ambiente',
  risk: 'o risco da jornada',
  journeyType: 'o tipo da jornada',
  dataClassifications: 'a classificação do dado',
  amountBRL: 'o valor (R$)',
  costBRL: 'o custo por execução (R$)',
  writeToolsWithoutPolicy: 'as tools de escrita sem política',
  hasOwnerApproval: 'a aprovação do dono de negócio',
  hasHumanNode: 'a intervenção humana',
  modelRegion: 'a região do modelo',
  evaluationScore: 'a nota de avaliação',
};

const OP_LABELS: Record<PolicyOp, string> = {
  eq: 'é',
  neq: 'não é',
  gt: 'é maior que',
  gte: 'é maior ou igual a',
  lt: 'é menor que',
  lte: 'é menor ou igual a',
  in: 'está entre',
  contains: 'contém',
};

const EFFECT_LABELS: Record<PolicyEffect, string> = {
  bloquear: 'bloquear',
  exigir_aprovacao: 'exigir aprovação',
  alertar: 'alertar',
};

const VALUE_LABELS: Record<string, string> = {
  dev: 'Dev', hml: 'Hml', prd: 'Prd',
  autonoma: 'autônoma', supervisionada: 'supervisionada', assistida: 'assistida',
  pii: 'PII', sensivel: 'sensível', interno: 'interno', publico: 'público',
  agentica: 'agêntica', automacao: 'automação',
};

function describeValue(v: PolicyOperand): string {
  if (Array.isArray(v)) return v.map(describeValue).join(' ou ');
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'number') return formatNumber(v);
  return VALUE_LABELS[v] ?? `«${v}»`;
}

/** Renderiza a regra como "quando … então …". */
export function describePolicy(code: string): string {
  const rule = parsePolicyCode(code);
  if (!rule) return 'regra inválida';
  const parts: string[] = [];
  for (const [field, cond] of Object.entries(rule.when)) {
    const label = FIELD_LABELS[field] ?? field;
    if (isOpMap(cond)) {
      for (const [op, v] of Object.entries(cond) as [PolicyOp, PolicyOperand][]) {
        parts.push(`${label} ${OP_LABELS[op] ?? op} ${describeValue(v)}`);
      }
    } else {
      parts.push(`${label} ${OP_LABELS.eq} ${describeValue(cond as PolicyOperand)}`);
    }
  }
  const when = parts.length ? parts.join(' e ') : 'sempre';
  return `quando ${when} então ${EFFECT_LABELS[rule.then ?? 'alertar']}`;
}

/** Nota mínima de avaliação definida nas políticas ativas do ambiente (padrão 4,0). */
export function minEvaluationScore(policies: Policy[], env: EnvId, fallback = 4.0): number {
  let min: number | null = null;
  for (const p of policies) {
    if (!p.active || !p.envs.includes(env)) continue;
    const rule = parsePolicyCode(p.code);
    if (!rule) continue;
    let v: number | undefined = rule.minEvaluationScore;
    const cond = rule.when.evaluationScore;
    if (v === undefined && cond && isOpMap(cond)) {
      const n = cond.lt ?? cond.lte;
      if (typeof n === 'number') v = n;
    }
    if (typeof v === 'number') min = min === null ? v : Math.max(min, v);
  }
  return min ?? fallback;
}
