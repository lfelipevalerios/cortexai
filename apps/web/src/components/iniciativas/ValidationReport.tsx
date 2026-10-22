'use client';

import { BookMarked, Loader2, Recycle, Sparkles, Terminal, TriangleAlert } from 'lucide-react';
import type { Validation } from '@cortex/schemas';
import { Chip, Mono, Progress, StatusChip, cx } from '@/components/ui';
import { SOLUTION_LABEL } from './shared';

/** Relatório das 8 checagens. `revealed` controla quantas já apareceram (animação). */
export function ValidationReport({ validation, revealed, running }: { validation: Validation; revealed: number; running: boolean }) {
  const checks = validation.checks.slice(0, revealed);
  const done = revealed >= validation.checks.length && !running;
  const counts = {
    verde: validation.checks.filter((c) => c.result === 'verde').length,
    amarelo: validation.checks.filter((c) => c.result === 'amarelo').length,
    vermelho: validation.checks.filter((c) => c.result === 'vermelho').length,
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-field border border-border bg-bg px-3 py-2">
        <Terminal className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <span className="text-xs text-text-muted">executado no Claude Code ·</span>
        <Mono className="text-accent-soft">/cortex:validar</Mono>
        {running && <Loader2 className="ml-auto h-4 w-4 animate-spin text-accent" strokeWidth={1.5} />}
        {done && <span className="ml-auto text-xs text-text-muted">{validation.checks.length} checagens concluídas</span>}
      </div>

      <ol className="space-y-2">
        {checks.map((c, i) => (
          <li key={c.key} className="animate-fade-in rounded-field border border-border bg-surface-2 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">
                <span className="mr-1.5 font-mono text-xs text-text-muted">{i + 1}.</span>
                {c.label}
              </div>
              <StatusChip status={c.result} />
            </div>
            <p className="mt-1 text-sm text-text-muted">{c.summary}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-accent-soft">
              <BookMarked className="h-3 w-3" strokeWidth={1.5} />
              Fonte no cérebro: {c.source}
            </div>
          </li>
        ))}
        {running && revealed < validation.checks.length && (
          <li className="flex items-center gap-2 rounded-field border border-dashed border-border px-3 py-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            Consultando o cérebro: {validation.checks[revealed]?.label}…
          </li>
        )}
      </ol>

      {done && (
        <div className="animate-fade-in space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-field border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-1 text-xs text-text-muted"><Recycle className="h-3.5 w-3.5" strokeWidth={1.5} /> Reuso</div>
              <div className="mt-1 text-2xl font-semibold text-primary">{validation.reusePct}%</div>
              <Progress value={validation.reusePct} />
            </div>
            <div className="rounded-field border border-border bg-surface-2 p-3">
              <div className="text-xs text-text-muted">Tipo de solução</div>
              <div className="mt-1 text-base font-semibold">{SOLUTION_LABEL[validation.solutionType]}</div>
            </div>
            <div className="rounded-field border border-border bg-surface-2 p-3">
              <div className="text-xs text-text-muted">Resultado</div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Chip tone="green">{counts.verde} favoráveis</Chip>
                {counts.amarelo > 0 && <Chip tone="yellow">{counts.amarelo} atenção</Chip>}
                {counts.vermelho > 0 && <Chip tone="red">{counts.vermelho} críticas</Chip>}
              </div>
            </div>
          </div>

          <div className="rounded-field border border-accent/40 bg-accent/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} /> Recomendação do cérebro
            </div>
            <p className="text-sm">{validation.recommendation}</p>
          </div>

          {validation.attention.length > 0 && (
            <div className="rounded-field border border-warning/40 bg-warning/5 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                <TriangleAlert className="h-4 w-4 text-warning" strokeWidth={1.5} /> Pontos de atenção
              </div>
              <ul className={cx('list-disc space-y-0.5 pl-5 text-sm text-text-muted')}>
                {validation.attention.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
