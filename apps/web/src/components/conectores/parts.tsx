'use client';

// Peças visuais compartilhadas do módulo: checagens de conexão e objetos descobertos.
import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Circle, Network, KeyRound, ShieldCheck, Gauge, ShieldAlert, type LucideIcon } from 'lucide-react';
import type { ConnectorTool, DiscoveredObject } from '@cortex/schemas';
import { formatNumber } from '@cortex/engine';
import { Chip, cx, Mono } from '@/components/ui';
import { CHECKS, expandSample, maskValue, type CheckKey, type CheckResult } from './helpers';

const CHECK_ICON: Record<CheckKey, LucideIcon> = { rede: Network, autenticacao: KeyRound, permissao: ShieldCheck, latencia: Gauge };

export function ChecksList({ results }: { results: CheckResult[] }) {
  return (
    <ul className="space-y-2">
      {CHECKS.map((c) => {
        const r = results.find((x) => x.key === c.key) ?? { key: c.key, status: 'pendente' as const };
        const Icon = CHECK_ICON[c.key];
        return (
          <li
            key={c.key}
            className={cx(
              'rounded-card border bg-surface-1 px-4 py-3 transition-all duration-200',
              r.status === 'ok' && 'border-primary/50 shadow-halo-green',
              r.status === 'falha' && 'border-danger/60 shadow-halo-red',
              r.status === 'rodando' && 'border-accent/60',
              r.status === 'pendente' && 'border-border',
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{c.label}</div>
                {r.detail && r.status === 'ok' && <div className="text-xs text-text-muted">{r.detail}</div>}
                {r.status === 'rodando' && <div className="text-xs text-text-muted">Verificando…</div>}
                {r.status === 'pendente' && <div className="text-xs text-text-muted">Aguardando</div>}
              </div>
              {r.ms !== undefined && (r.status === 'ok' || r.status === 'falha') && <Mono className="text-text-muted">{formatNumber(r.ms)} ms</Mono>}
              {r.status === 'ok' && <Chip tone="green" icon={CheckCircle2}>OK</Chip>}
              {r.status === 'falha' && <Chip tone="red" icon={XCircle}>Falhou</Chip>}
              {r.status === 'rodando' && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
              {r.status === 'pendente' && <Circle className="h-5 w-5 text-border" />}
            </div>
            {r.status === 'falha' && (
              <div className="mt-2 rounded-field border border-danger/30 bg-danger/5 px-3 py-2 text-xs">
                <div><span className="font-semibold text-danger">Causa:</span> {r.cause}</div>
                <div className="mt-0.5"><span className="font-semibold">Como corrigir:</span> {r.fix}</div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ModeChip({ mode }: { mode: ConnectorTool['mode'] }) {
  return mode === 'leitura' ? <Chip tone="lilac">Leitura</Chip> : <Chip tone="yellow">Escrita</Chip>;
}

export function PiiChip() {
  return <Chip tone="red" icon={ShieldAlert}>PII</Chip>;
}

/** Lista de objetos com contagem, campos (PII marcada) e amostra de até 10 linhas mascaradas. */
export function ObjectsView({ objects, sampleRows = 10, showRecords = true }: { objects: DiscoveredObject[]; sampleRows?: number; showRecords?: boolean }) {
  const [sel, setSel] = useState(0);
  const o = objects[Math.min(sel, objects.length - 1)];
  if (!o) return null;
  const rows = expandSample(o.sample, sampleRows);
  const piiCount = o.fields.filter((f) => f.pii).length;
  return (
    <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
      <ul className="space-y-1.5">
        {objects.map((x, i) => {
          const pii = x.fields.filter((f) => f.pii).length;
          return (
            <li key={x.name}>
              <button
                onClick={() => setSel(i)}
                className={cx(
                  'w-full rounded-field border px-3 py-2 text-left transition-colors',
                  i === sel ? 'border-accent bg-accent/10' : 'border-border bg-surface-1 hover:bg-surface-2',
                )}
              >
                <div className="truncate text-sm font-medium">{x.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                  <span>{x.kind}</span>
                  {showRecords && x.records > 0 && <span>· {formatNumber(x.records)} registros</span>}
                  {pii > 0 && <span className="text-danger">· {pii} PII</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {o.fields.map((f) => (
            <span key={f.name} className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', f.pii ? 'border-danger/40 bg-danger/5' : 'border-border bg-surface-2')}>
              <span className="font-mono">{f.name}</span>
              <span className="text-text-muted">{f.type}</span>
              {f.pii && <PiiChip />}
            </span>
          ))}
        </div>
        {piiCount > 0 && (
          <p className="text-xs text-text-muted">
            {piiCount === 1 ? '1 campo pessoal identificado e marcado como PII' : `${piiCount} campos pessoais identificados e marcados como PII`}; os valores aparecem mascarados.
          </p>
        )}
        {rows.length > 0 ? (
          <div className="overflow-auto rounded-card border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-2">
                <tr>
                  {o.fields.map((f) => (
                    <th key={f.name} className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium text-text-muted">
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {o.fields.map((f) => (
                      <td key={f.name} className={cx('whitespace-nowrap px-2.5 py-1.5 font-mono', f.pii && 'text-danger/90')}>
                        {maskValue(r[f.name] ?? null, f.pii)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Sem amostra disponível para este objeto.</p>
        )}
      </div>
    </div>
  );
}
