'use client';

import Link from 'next/link';
import { Activity, Loader2, ShieldCheck } from 'lucide-react';
import { NODE_CATEGORIES } from '@cortex/schemas';
import { formatBRL, formatNumber, maskPii, summarizeTrace } from '@cortex/engine';
import { Chip, EmptyState, Mono, StatusChip, cx } from '@/components/ui';
import { fmtMs, type useJourneyRun } from './useJourneyRun';

type Run = ReturnType<typeof useJourneyRun>;

/** Trace ao lado do simulador: caixinha por caixinha, com status, tokens e latência. */
export function TracePanel({ run, className }: { run: Run; className?: string }) {
  const { planned, steps, running, graph, lastExecution } = run;
  if (!planned.length) {
    return (
      <div className={className}>
        <EmptyState
          icon={Activity}
          title="O trace aparece aqui"
          description="Envie uma mensagem no simulador: cada etapa da jornada acende em ordem, com status, tokens e latência."
        />
      </div>
    );
  }
  const sum = summarizeTrace(steps);
  const nodeOf = (id: string) => graph?.nodes.find((n) => n.id === id);
  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Activity className="h-4 w-4 text-accent" strokeWidth={1.5} /> Trace da execução
        </div>
        {running ? (
          <Chip tone="lilac" icon={Loader2}>Executando</Chip>
        ) : lastExecution ? (
          <StatusChip status={lastExecution.result} />
        ) : null}
      </div>
      <ol className="min-h-0 flex-1 space-y-1.5 overflow-auto pr-1" aria-live="polite">
        {planned.map((p, i) => {
          const done = steps[i];
          const active = !done && running && i === steps.length;
          const node = nodeOf(p.nodeId);
          const color = node ? NODE_CATEGORIES[node.category].color : '#A99FB8';
          return (
            <li
              key={`${p.nodeId}-${i}`}
              className={cx(
                'rounded-field border bg-surface-1 px-2.5 py-2 transition-all duration-200',
                done ? 'border-border' : 'border-dashed border-border opacity-50',
                active && 'animate-pulse-halo opacity-100',
                done?.status === 'alerta' && 'border-warning/60',
                (done?.status === 'erro' || done?.status === 'bloqueado') && 'border-danger/60 animate-shake',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.label}</span>
                {done ? <StatusChip status={done.status === 'alerta' ? 'amarelo' : done.status} label={done.status === 'alerta' ? 'Guardrail agiu' : undefined} /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : null}
              </div>
              {done && (
                <>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">{maskPii(done.output)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-text-muted">
                    <span>{formatNumber(done.tokens)} tokens</span>
                    <span>{fmtMs(done.latencyMs)}</span>
                    {done.rule && <span className="truncate text-accent-soft">regra: {done.rule}</span>}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 grid grid-cols-3 gap-2 rounded-field border border-border bg-surface-2 p-2 text-center">
        <div><div className="text-sm font-semibold text-primary">{formatNumber(sum.tokens)}</div><div className="text-[10px] text-text-muted">tokens</div></div>
        <div><div className="text-sm font-semibold">{fmtMs(sum.latencyMs)}</div><div className="text-[10px] text-text-muted">latência</div></div>
        <div><div className="text-sm font-semibold">{formatBRL(sum.costBRL)}</div><div className="text-[10px] text-text-muted">custo</div></div>
      </div>
      {lastExecution && !running && (
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            {lastExecution.guardrail && <ShieldCheck className="h-3.5 w-3.5 text-warning" />}
            Execução <Mono>{lastExecution.id}</Mono> registrada
          </span>
          <Link href="/telemetria" className="text-primary-soft hover:underline">Ver na Telemetria</Link>
        </div>
      )}
      <p className="mt-1 text-[10px] text-text-muted">Dados pessoais aparecem mascarados nesta visualização.</p>
    </div>
  );
}
