// Utilitários compartilhados por Governança e Telemetria.
import type { IndustryId, Policy } from '@cortex/schemas';
import type { ChipTone } from '@/components/ui';

export const PREFIX: Record<IndustryId, string> = { saude: 'sau', varejo: 'var', financeiro: 'fin', telecom: 'tel' };

/** "21/10 08:14" a partir de um ISO do seed (já no fuso de Brasília) ou da demo. */
export function fmtDateTime(iso: string): string {
  if (!iso || iso.length < 16) return iso;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
}

export function fmtDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export const EFFECT_META: Record<Policy['effect'], { label: string; tone: ChipTone }> = {
  bloquear: { label: 'Bloquear', tone: 'red' },
  exigir_aprovacao: { label: 'Exigir aprovação', tone: 'yellow' },
  alertar: { label: 'Alertar', tone: 'lilac' },
};

export const KIND_LABEL: Record<Policy['kind'], string> = {
  stack: 'Stack',
  jornada: 'Jornada',
  dado: 'Dado',
};

export const RISK_META = {
  assistida: { label: 'Assistida', tone: 'green' as ChipTone, help: 'A IA sugere; uma pessoa decide e executa cada passo.' },
  supervisionada: { label: 'Supervisionada', tone: 'yellow' as ChipTone, help: 'A IA executa; uma pessoa revisa exceções e decisões acima da alçada.' },
  autonoma: { label: 'Autônoma', tone: 'red' as ChipTone, help: 'A IA age sozinha dentro dos guardrails; as políticas mais rígidas se aplicam.' },
};

/** Id da jornada a partir do objectId de uma promoção ("<id>@<versão>->prd" ou só "<id>"). */
export function journeyIdFromObject(objectId: string): string {
  return objectId.split('@')[0];
}

/** Gera e baixa um CSV (separador ";", compatível com Excel pt-BR). */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
