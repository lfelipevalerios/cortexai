'use client';

import { useMemo, useState } from 'react';
import { Download, Lock, Search, ScrollText } from 'lucide-react';
import { PROFILES, ENVS, type EnvId } from '@cortex/schemas';
import { SEED_TODAY } from '@cortex/seed';
import { useCortex, useWs } from '@/lib/store';
import { Button, EmptyState, EnvBadge, Field, Input, Select, Table, Mono } from '@/components/ui';
import { downloadCsv, fmtDateTime } from './shared';

type Period = '1' | '7' | '14' | '30' | 'tudo';

export function AuditTab() {
  const ws = useWs();
  const toast = useCortex((s) => s.toast);
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('todos');
  const [period, setPeriod] = useState<Period>('tudo');
  const [env, setEnv] = useState<'todos' | EnvId>('todos');

  const actors = useMemo(() => Array.from(new Set(ws.audit.map((e) => e.actor))).sort(), [ws.audit]);

  const rows = useMemo(() => {
    const end = Date.parse(`${SEED_TODAY}T23:59:59-03:00`);
    const days = period === 'tudo' ? null : Number(period);
    const needle = q.trim().toLowerCase();
    return ws.audit.filter((e) => {
      if (actor !== 'todos' && e.actor !== actor) return false;
      if (env !== 'todos' && e.env !== env) return false;
      if (days !== null && end - Date.parse(e.at) > days * 86400000) return false;
      if (needle && !`${e.object} ${e.action}`.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [ws.audit, q, actor, period, env]);

  const exportCsv = () => {
    downloadCsv(
      `auditoria-${ws.workspace.id}-${SEED_TODAY}.csv`,
      ['id', 'data_hora', 'pessoa', 'perfil', 'acao', 'objeto', 'ambiente'],
      rows.map((e) => [e.id, e.at, e.actor, PROFILES[e.profile].label, e.action, e.object, ENVS[e.env].label]),
    );
    useCortex.getState().mutate(() => undefined, { action: 'Exportou trilha de auditoria', object: `${rows.length} eventos (filtro atual)` });
    toast({ kind: 'sucesso', title: 'Trilha exportada', description: `${rows.length} eventos em CSV. A exportação também ficou registrada na auditoria.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-card border border-border bg-surface-1 px-4 py-3 text-sm text-text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
        Trilha imutável: cada ação de pessoas e agentes fica registrada com quem, o quê, quando e em qual ambiente. Eventos não podem ser editados nem apagados.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
        <Field label="Objeto ou ação">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: promoção, contrato, OC" className="pl-9" />
          </div>
        </Field>
        <Field label="Pessoa">
          <Select value={actor} onChange={(e) => setActor(e.target.value)} options={[{ value: 'todos', label: 'Todas as pessoas' }, ...actors.map((a) => ({ value: a, label: a }))]} />
        </Field>
        <Field label="Período">
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            options={[
              { value: '1', label: 'Últimas 24 horas' },
              { value: '7', label: 'Últimos 7 dias' },
              { value: '14', label: 'Últimos 14 dias' },
              { value: '30', label: 'Últimos 30 dias' },
              { value: 'tudo', label: 'Todo o histórico' },
            ]}
          />
        </Field>
        <Field label="Ambiente">
          <Select value={env} onChange={(e) => setEnv(e.target.value as 'todos' | EnvId)} options={[{ value: 'todos', label: 'Todos' }, { value: 'dev', label: 'Dev' }, { value: 'hml', label: 'Hml' }, { value: 'prd', label: 'Prd' }]} />
        </Field>
        <Button variant="tertiary" icon={Download} onClick={exportCsv} disabled={rows.length === 0}>Exportar CSV</Button>
      </div>
      <div className="text-xs text-text-muted">{rows.length} de {ws.audit.length} eventos</div>
      <Table
        dense
        rows={rows}
        rowKey={(e) => e.id}
        empty={<EmptyState icon={ScrollText} title="Nenhum evento neste filtro" description="Amplie o período ou limpe a busca para ver mais eventos da trilha." />}
        columns={[
          { key: 'at', header: 'Quando', render: (e) => <Mono className="text-text-muted">{fmtDateTime(e.at)}</Mono>, className: 'whitespace-nowrap' },
          { key: 'actor', header: 'Pessoa', render: (e) => <div><div className="text-sm">{e.actor}</div><div className="text-xs text-text-muted">{PROFILES[e.profile].label}</div></div> },
          { key: 'action', header: 'Ação', render: (e) => e.action },
          { key: 'object', header: 'Objeto', render: (e) => <span className="text-text-muted">{e.object}</span> },
          { key: 'env', header: 'Ambiente', render: (e) => <EnvBadge env={e.env} /> },
        ]}
      />
    </div>
  );
}
