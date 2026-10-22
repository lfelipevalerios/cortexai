'use client';

import type { ContractField, DataClassification, DataContract, WorkspaceData } from '@cortex/schemas';
import { findBreakingConsumers, latestContractVersion, maskPii } from '@cortex/engine';
import { ShieldAlert, Lock, Building2, Globe2, type LucideIcon } from 'lucide-react';
import { Chip, type ChipTone } from '@/components/ui';

export const CLASSIFICATION: Record<DataClassification, { label: string; tone: ChipTone; icon: LucideIcon }> = {
  pii: { label: 'PII', tone: 'red', icon: ShieldAlert },
  sensivel: { label: 'Sensível', tone: 'yellow', icon: Lock },
  interno: { label: 'Interno', tone: 'purple', icon: Building2 },
  publico: { label: 'Público', tone: 'green', icon: Globe2 },
};

export function ClassChip({ value }: { value: DataClassification }) {
  const c = CLASSIFICATION[value];
  return (
    <Chip tone={c.tone} icon={c.icon}>
      {c.label}
    </Chip>
  );
}

/** Minigráfico de linha em SVG (histórico de qualidade). */
export function Sparkline({ values, failing, width = 96, height = 24 }: { values: number[]; failing?: boolean; width?: number; height?: number }) {
  if (!values.length) return null;
  const min = Math.min(...values, 80);
  const max = 100;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / (max - min || 1)) * (height - 4) - 2).toFixed(1)}`);
  const color = failing ? '#FF7A9A' : '#00FF95';
  const last = pts[pts.length - 1].split(',');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label={`Histórico: ${values.map((v) => v.toFixed(1)).join(', ')}%`}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

export const studioHref = (journeyId: string) => `/jornadas/studio?id=${journeyId}`;

/** Campos do contrato usados por jornadas em Prd (remover ou mudar o tipo quebra). */
export function fieldsUsedInPrd(contract: DataContract, ws: WorkspaceData): Map<string, string[]> {
  const latest = latestContractVersion(contract);
  const out = new Map<string, string[]>();
  if (!latest) return out;
  for (const f of latest.fields) {
    const without = latest.fields.filter((x) => x.name !== f.name);
    const hits = findBreakingConsumers(contract, without, ws);
    if (hits.length) out.set(f.name, hits.map((h) => h.journeyName));
  }
  return out;
}

/** Valor de amostra mascarado quando a coluna é PII. */
export function maskValue(v: string | number | boolean | null, pii?: boolean): string {
  if (v === null || v === undefined) return '—';
  const s = String(v);
  if (!pii) return s;
  const masked = maskPii(s);
  if (masked !== s) return masked;
  if (s.length <= 2) return '**';
  return `${s.slice(0, 1)}${'*'.repeat(Math.min(8, s.length - 2))}${s.slice(-1)}`;
}

export function avgQuality(contracts: DataContract[]): number | null {
  const last: number[] = [];
  for (const c of contracts) {
    const v = latestContractVersion(c);
    v?.quality.forEach((q) => q.history.length && last.push(q.history[q.history.length - 1]));
  }
  if (!last.length) return null;
  return last.reduce((a, b) => a + b, 0) / last.length;
}

export const FIELD_TYPES = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'array', 'object'];

export function emptyField(): ContractField {
  return { name: '', type: 'string', required: false, classification: 'interno', description: '' };
}
