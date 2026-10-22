'use client';

// Aba Testar: entrada da persona, trace passo a passo com contador de tokens e custo,
// casos de teste salvos e suíte.
import { Play, Save, ListChecks, ShieldAlert, Wand2, Loader2, CheckCircle2, User } from 'lucide-react';
import type { Journey, TraceStep } from '@cortex/schemas';
import { formatNumber, summarizeTrace } from '@cortex/engine';
import { Button, Chip, StatusChip, cx } from '@/components/ui';
import { brl4 } from './lib';

export interface RunState {
  status: 'idle' | 'running' | 'passou' | 'bloqueado';
  steps: TraceStep[];
  doneIds: string[];
  edgeIds: string[];
  activeNodeId?: string;
  blockedNodeId?: string;
  shakeKey?: number;
  input: string;
}

export const IDLE_RUN: RunState = { status: 'idle', steps: [], doneIds: [], edgeIds: [], input: '' };

export function TestPanel({
  journey, run, input, setInput, onRun, onSaveCase, onRunSuite, suiteRunning, suiteIndex, onFixPii, hasPiiFix, editable,
}: {
  journey: Journey;
  run: RunState;
  input: string;
  setInput: (v: string) => void;
  onRun: () => void;
  onSaveCase: () => void;
  onRunSuite: () => void;
  suiteRunning: boolean;
  suiteIndex: number;
  onFixPii: () => void;
  hasPiiFix: boolean;
  editable: boolean;
}) {
  const totals = summarizeTrace(run.steps);
  const running = run.status === 'running';
  const blockedStep = run.steps.find((s) => s.status === 'bloqueado');

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="lilac" icon={User}>Persona: {journey.persona.name}</Chip>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Mensagem de entrada do teste"
            className="h-8 min-w-[220px] flex-1 rounded-field border border-border bg-surface-2 px-3 text-xs focus:border-primary focus:outline-none"
          />
          <Button size="sm" variant="primary" icon={Play} loading={running} onClick={onRun}>
            Executar
          </Button>
          <div className="flex items-center gap-3 rounded-full border border-border bg-bg px-3 py-1 font-mono text-[11px] text-text-muted" aria-live="polite">
            <span><b className="text-primary">{formatNumber(totals.tokens)}</b> tokens</span>
            <span><b className="text-primary">{brl4(totals.costBRL)}</b></span>
            <span>{formatNumber(totals.latencyMs)} ms</span>
          </div>
        </div>

        {run.status === 'bloqueado' && blockedStep && (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-field border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0 text-danger" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <b className="font-medium text-danger">Guardrail acionado:</b> {blockedStep.output}.{' '}
              <span className="text-text-muted">Regra: {blockedStep.rule}</span>
            </div>
            {hasPiiFix && (
              <Button size="sm" variant="primary" icon={Wand2} onClick={onFixPii} disabled={!editable} data-tour="studio-corrigir-pii">
                Inserir filtro de PII
              </Button>
            )}
          </div>
        )}
        {run.status === 'passou' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-primary">
            <CheckCircle2 className="h-4 w-4" /> Teste concluído sem bloqueios em {run.steps.length} etapas.
          </div>
        )}

        <div className="mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          {run.steps.length === 0 && !running ? (
            <div className="flex h-full items-center justify-center rounded-field border border-dashed border-border text-sm text-text-muted">
              Rode o teste com a persona: as caixinhas acendem em ordem e cada etapa mostra entrada, saída, regra, fonte, tokens, latência e custo.
            </div>
          ) : (
            <ol className="flex h-full gap-2 pb-1">
              {run.steps.map((s, i) => (
                <StepCard key={`${s.nodeId}-${i}`} step={s} index={i} />
              ))}
              {running && (
                <li className="flex w-40 shrink-0 items-center justify-center rounded-field border border-dashed border-primary/40 text-xs text-primary">
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> executando…
                </li>
              )}
            </ol>
          )}
        </div>
      </div>

      <div className="flex w-[280px] shrink-0 flex-col rounded-field border border-border bg-bg/40">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-semibold">Casos de teste ({journey.testCases.length})</span>
          <Button size="sm" variant="tertiary" icon={ListChecks} loading={suiteRunning} onClick={onRunSuite} disabled={journey.testCases.length === 0}>
            Rodar suíte
          </Button>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
          {journey.testCases.length === 0 && <li className="p-2 text-xs text-text-muted">Nenhum caso salvo. Rode um teste e salve como caso.</li>}
          {journey.testCases.map((c, i) => (
            <li key={c.id} className="flex items-start justify-between gap-2 rounded-field px-2 py-1.5 hover:bg-surface-2" title={`Entrada: ${c.input}\nEsperado: ${c.expected}`}>
              <span className="min-w-0 text-xs">
                <span className="block truncate">{c.name}</span>
                <span className="block truncate text-[11px] text-text-muted">{c.expected}</span>
              </span>
              {suiteRunning && i >= suiteIndex ? (
                <Chip tone="muted" icon={Loader2}>Rodando</Chip>
              ) : c.lastResult ? (
                <StatusChip status={c.lastResult} />
              ) : (
                <Chip tone="muted">Sem resultado</Chip>
              )}
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-2">
          <Button size="sm" variant="secondary" icon={Save} className="w-full" disabled={run.status !== 'passou'} onClick={onSaveCase}>
            Salvar como caso de teste
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, index }: { step: TraceStep; index: number }) {
  const tone = step.status === 'bloqueado' || step.status === 'erro' ? 'red' : step.status === 'alerta' ? 'yellow' : 'green';
  return (
    <li
      className={cx(
        'flex w-64 shrink-0 animate-fade-in flex-col overflow-hidden rounded-field border bg-surface-1 p-2.5 text-xs',
        tone === 'red' && 'border-danger/60 bg-danger/5',
        tone === 'yellow' && 'border-warning/50',
        tone === 'green' && 'border-primary/40',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate font-medium">
          <span className="mr-1 font-mono text-text-muted">{index + 1}.</span>
          {step.label}
        </span>
        <StatusChip
          status={step.status === 'ok' ? 'ok' : step.status === 'alerta' ? 'amarelo' : step.status === 'bloqueado' ? 'bloqueado' : 'erro'}
          label={step.status === 'alerta' ? 'Alerta' : undefined}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto">
        <p className="line-clamp-2"><span className="text-text-muted">Entrada: </span>{step.input}</p>
        <p className={cx('line-clamp-3', tone === 'red' && 'text-danger')}><span className="text-text-muted">Saída: </span>{step.output}</p>
        {step.rule && <p className="line-clamp-2"><span className="text-text-muted">Regra aplicada: </span>{step.rule}</p>}
        {step.source && <p className="line-clamp-1"><span className="text-text-muted">Fonte: </span>{step.source}</p>}
      </div>
      <div className="mt-1.5 flex gap-2 border-t border-border pt-1.5 font-mono text-[10px] text-text-muted">
        <span>{formatNumber(step.tokens)} tok</span>
        <span>{formatNumber(step.latencyMs)} ms</span>
        <span>{brl4(step.costBRL)}</span>
      </div>
    </li>
  );
}
