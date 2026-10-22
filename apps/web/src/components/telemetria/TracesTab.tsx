'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ChevronDown, ChevronRight, ListTree, Scale, BookOpen, Coins, Timer, Hash } from 'lucide-react';
import type { EnvId, Execution, TraceStep } from '@cortex/schemas';
import { formatBRL, formatNumber } from '@cortex/engine';
import { useWs } from '@/lib/store';
import { Card, CardHeader, Chip, EmptyState, EnvBadge, Field, Select, StatusChip, Table, Mono, cx } from '@/components/ui';
import { fmtDateTime } from '@/components/governanca/shared';

export interface TraceFilters {
  journey: string;
  channel: string;
  env: 'todos' | EnvId;
  result: 'todos' | Execution['result'];
}
export const EMPTY_FILTERS: TraceFilters = { journey: 'todos', channel: 'todos', env: 'todos', result: 'todos' };

const RESULT_LABEL: Record<Execution['result'], string> = { sucesso: 'Sucesso', transbordo: 'Transbordo', erro: 'Erro', bloqueado: 'Bloqueado' };
const STEP_STATUS: Record<TraceStep['status'], { status: string; label: string }> = {
  ok: { status: 'ok', label: 'OK' },
  alerta: { status: 'amarelo', label: 'Alerta' },
  erro: { status: 'erro', label: 'Erro' },
  bloqueado: { status: 'bloqueado', label: 'Bloqueado' },
};

export function filterExecutions(ex: Execution[], f: TraceFilters) {
  return ex.filter((e) =>
    (f.journey === 'todos' || e.journeyId === f.journey)
    && (f.channel === 'todos' || e.channel === f.channel)
    && (f.env === 'todos' || e.env === f.env)
    && (f.result === 'todos' || e.result === f.result));
}

export function TracesTab({ filters, onFilters, selectedId, onSelect }: {
  filters: TraceFilters;
  onFilters: (f: TraceFilters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ws = useWs();
  const rows = filterExecutions(ws.executions, filters);
  const selected = ws.executions.find((e) => e.id === selectedId) ?? null;
  const jName = (id: string) => ws.journeys.find((j) => j.id === id)?.name ?? id;
  const chName = (id: string) => ws.channels.find((c) => c.id === id)?.name ?? id;
  const channelIds = Array.from(new Set(ws.executions.map((e) => e.channel)));
  const journeyIds = Array.from(new Set(ws.executions.map((e) => e.journeyId)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Jornada">
          <Select value={filters.journey} onChange={(e) => onFilters({ ...filters, journey: e.target.value })} options={[{ value: 'todos', label: 'Todas' }, ...journeyIds.map((id) => ({ value: id, label: jName(id) }))]} />
        </Field>
        <Field label="Canal">
          <Select value={filters.channel} onChange={(e) => onFilters({ ...filters, channel: e.target.value })} options={[{ value: 'todos', label: 'Todos' }, ...channelIds.map((id) => ({ value: id, label: chName(id) }))]} />
        </Field>
        <Field label="Ambiente">
          <Select value={filters.env} onChange={(e) => onFilters({ ...filters, env: e.target.value as TraceFilters['env'] })} options={[{ value: 'todos', label: 'Todos' }, { value: 'dev', label: 'Dev' }, { value: 'hml', label: 'Hml' }, { value: 'prd', label: 'Prd' }]} />
        </Field>
        <Field label="Resultado">
          <Select value={filters.result} onChange={(e) => onFilters({ ...filters, result: e.target.value as TraceFilters['result'] })} options={[{ value: 'todos', label: 'Todos' }, ...(Object.keys(RESULT_LABEL) as Execution['result'][]).map((r) => ({ value: r, label: RESULT_LABEL[r] }))]} />
        </Field>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
        <div className="min-w-0">
          <div className="mb-2 text-xs text-text-muted">{rows.length} de {ws.executions.length} execuções</div>
          <Table
            dense
            rows={rows}
            rowKey={(e) => e.id}
            onRowClick={(e) => onSelect(e.id)}
            empty={<EmptyState icon={ListTree} title="Nenhuma execução neste filtro" description="Limpe os filtros para ver todas as execuções." />}
            columns={[
              { key: 'at', header: 'Quando', render: (e) => <Mono className={cx(e.id === selectedId ? 'text-primary' : 'text-text-muted')}>{fmtDateTime(e.at)}</Mono> },
              { key: 'j', header: 'Jornada', render: (e) => <span className={cx(e.id === selectedId && 'font-medium text-primary')}>{jName(e.journeyId)}</span> },
              { key: 'c', header: 'Canal', render: (e) => <span className="text-text-muted">{chName(e.channel)}</span> },
              { key: 'env', header: 'Amb.', render: (e) => <EnvBadge env={e.env} /> },
              { key: 'r', header: 'Resultado', render: (e) => <div className="flex items-center gap-1"><StatusChip status={e.result} label={RESULT_LABEL[e.result]} />{e.guardrail && <ShieldAlert className="h-4 w-4 text-danger" aria-label="Guardrail acionado" />}</div> },
              { key: 'l', header: 'Tempo', render: (e) => <span className="text-text-muted">{formatNumber(e.latencyMs / 1000, 1)} s</span> },
            ]}
          />
        </div>
        <div data-tour="telemetria-trace" className="min-w-0">
          {selected ? <TraceTree exec={selected} journeyName={jName(selected.journeyId)} channelName={chName(selected.channel)} /> : (
            <EmptyState icon={ListTree} title="Selecione uma execução" description="O trace mostra cada passo em árvore: entrada, saída, regra, fonte, tokens e tempo." />
          )}
        </div>
      </div>
    </div>
  );
}

function isGuardStep(exec: Execution, s: TraceStep) {
  return s.status === 'bloqueado' || (!!exec.guardrail && s.status === 'alerta' && s.nodeId.length > 0 && /pii|guard|filtro/i.test(`${s.label} ${s.nodeId} ${s.output}`));
}

function TraceTree({ exec, journeyName, channelName }: { exec: Execution; journeyName: string; channelName: string }) {
  return (
    <Card halo={exec.guardrail ? 'red' : undefined}>
      <CardHeader
        icon={ListTree}
        title={<span>Trace <Mono>{exec.id}</Mono></span>}
        subtitle={`${journeyName} · ${channelName} · ${fmtDateTime(exec.at)}`}
        actions={<><EnvBadge env={exec.env} /><StatusChip status={exec.result} label={RESULT_LABEL[exec.result]} /></>}
      />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Chip icon={Timer}>{formatNumber(exec.latencyMs, 0)} ms</Chip>
          <Chip icon={Hash}>{formatNumber(exec.tokens, 0)} tokens</Chip>
          <Chip icon={Coins}>{formatBRL(exec.costBRL)}</Chip>
          <Chip>{exec.steps.length} passos</Chip>
          <Link href={`/jornadas/studio?id=${exec.journeyId}`} className="ml-auto text-primary hover:underline">Abrir jornada no Studio</Link>
        </div>
        {exec.guardrail && (
          <div className="flex items-start gap-2 rounded-field border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div><b className="font-medium text-danger">Guardrail acionado.</b> {exec.guardrail}</div>
          </div>
        )}
        <ol className="relative space-y-2 border-l border-border pl-5">
          {exec.steps.map((s, i) => <StepItem key={`${exec.id}-${s.nodeId}-${i}`} step={s} index={i} guard={isGuardStep(exec, s)} />)}
        </ol>
      </div>
    </Card>
  );
}

function StepItem({ step: s, index, guard }: { step: TraceStep; index: number; guard: boolean }) {
  const [open, setOpen] = useState(guard || s.status !== 'ok');
  const st = STEP_STATUS[s.status];
  return (
    <li className="relative">
      <span className={cx('absolute -left-[29px] top-2.5 flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-semibold', guard ? 'border-danger bg-danger text-on-primary' : 'border-border bg-surface-2 text-text-muted')}>
        {index + 1}
      </span>
      <div className={cx('rounded-field border', guard ? 'border-danger/70 bg-danger/10 shadow-halo-red' : 'border-border bg-surface-2/40')}>
        <button className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
          <span className={cx('flex-1 text-sm font-medium', guard && 'text-danger')}>{s.label}</span>
          {guard && <Chip tone="red" icon={ShieldAlert}>Guardrail</Chip>}
          <StatusChip status={st.status} label={st.label} />
          <span className="hidden text-xs text-text-muted sm:inline">{formatNumber(s.tokens, 0)} tok · {formatNumber(s.latencyMs, 0)} ms</span>
        </button>
        {open && (
          <div className="space-y-2 border-t border-border px-3 py-2 text-xs">
            <KV label="Entrada" value={s.input || '—'} />
            <KV label="Saída" value={s.output || '—'} strong={guard} />
            {s.rule && <KV icon={Scale} label="Regra" value={s.rule} />}
            {s.source && <KV icon={BookOpen} label="Fonte" value={s.source} />}
            <div className="flex flex-wrap gap-3 text-text-muted">
              <span>Tokens: {formatNumber(s.tokens, 0)}</span>
              <span>Tempo: {formatNumber(s.latencyMs, 0)} ms</span>
              <span>Custo: {formatBRL(s.costBRL)}</span>
              <span>Nó: <Mono>{s.nodeId}</Mono></span>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function KV({ label, value, icon: Icon, strong }: { label: string; value: string; icon?: typeof Scale; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[70px_1fr] gap-2">
      <span className="flex items-center gap-1 text-text-muted">{Icon && <Icon className="h-3 w-3" />}{label}</span>
      <span className={cx('whitespace-pre-wrap', strong && 'font-medium text-danger')}>{value}</span>
    </div>
  );
}
