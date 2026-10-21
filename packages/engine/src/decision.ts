// Tabelas de decisão do cérebro: primeira linha que casa vence.
import type { DecisionRow, DecisionTable } from '@cortex/schemas';

export type DecisionValue = string | number | boolean;

export interface DecisionResult {
  row: DecisionRow | null;
  matchedIndex: number;
  trace: { rowId: string; key: string; condition: string; ok: boolean }[];
}

const NUM = '-?\\d+(?:[.,]\\d+)?';
const RANGE_RE = new RegExp(`^(${NUM})\\s*\\.\\.\\s*(${NUM})$`);

function toNumber(v: DecisionValue | undefined | string): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean' || v === undefined) return null;
  const s = v.trim().replace(',', '.');
  if (s === '' || !/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function norm(v: DecisionValue | undefined): string {
  if (v === undefined) return '';
  return String(v).trim().toLowerCase();
}

function equals(input: DecisionValue | undefined, expected: string): boolean {
  if (input === undefined) return false;
  const e = expected.trim();
  if (typeof input === 'boolean') {
    const el = e.toLowerCase();
    if (el === 'true' || el === 'sim') return input === true;
    if (el === 'false' || el === 'não' || el === 'nao') return input === false;
    return false;
  }
  const a = toNumber(input);
  const b = toNumber(e);
  if (a !== null && b !== null) return a === b;
  return norm(input) === e.toLowerCase();
}

/** Avalia uma célula de condição contra o valor de entrada. */
export function matchCondition(condition: string | undefined, input: DecisionValue | undefined): boolean {
  const c = (condition ?? '').trim();
  if (c === '' || c === '*') return true;
  const range = RANGE_RE.exec(c);
  if (range) {
    const n = toNumber(input);
    const lo = toNumber(range[1])!;
    const hi = toNumber(range[2])!;
    return n !== null && n >= lo && n <= hi;
  }
  for (const op of ['>=', '<=', '!=', '>', '<', '='] as const) {
    if (!c.startsWith(op)) continue;
    const rest = c.slice(op.length).trim();
    if (op === '=') return rest.split('|').some((v) => equals(input, v));
    if (op === '!=') return input !== undefined && !rest.split('|').some((v) => equals(input, v));
    const n = toNumber(input);
    const m = toNumber(rest);
    if (n === null || m === null) return false;
    if (op === '>=') return n >= m;
    if (op === '<=') return n <= m;
    if (op === '>') return n > m;
    return n < m;
  }
  return c.split('|').some((v) => equals(input, v));
}

export function evaluateDecisionTable(table: DecisionTable, input: Record<string, DecisionValue>): DecisionResult {
  const trace: DecisionResult['trace'] = [];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    let all = true;
    for (const [key, condition] of Object.entries(row.conditions)) {
      const ok = matchCondition(condition, input[key]);
      trace.push({ rowId: row.id, key, condition, ok });
      if (!ok) all = false;
    }
    if (all) return { row, matchedIndex: i, trace };
  }
  return { row: null, matchedIndex: -1, trace };
}
