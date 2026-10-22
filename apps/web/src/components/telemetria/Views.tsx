'use client';

import Link from 'next/link';
import { Code2, Gauge, Boxes, Database, Target, Hammer, Info } from 'lucide-react';
import type { MetricSeries, WorkspaceData } from '@cortex/schemas';
import { formatNumber, formatBRL } from '@cortex/engine';
import { useWs } from '@/lib/store';
import { Card, CardHeader, Chip, EmptyState, Progress, StatusChip, Table, Mono } from '@/components/ui';
import { EChart } from '@/components/ui/EChart';
import { colors } from '@cortex/ui';
import { MetricGrid, DeltaLabel, fmtValue, seriesDelta, SeriesChart } from './MetricCharts';
import { fmtDateTime } from '@/components/governanca/shared';

export type MetricView = MetricSeries['view'];

function metricsOf(ws: WorkspaceData, view: MetricView) {
  return ws.metrics.filter((m) => m.view === view);
}

function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-text-muted">
      <Info className="h-3.5 w-3.5" /> {children}
    </p>
  );
}

function SmallStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-field border border-border bg-surface-2/40 px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}

function percentile(xs: number[], p: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export function OperacaoView() {
  const ws = useWs();
  const ex = ws.executions;
  const lat = ex.map((e) => e.latencyMs);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Amostra das execuções recentes" subtitle={`${ex.length} execuções registradas nos últimos 7 dias (base dos traces)`} />
        <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
          <SmallStat label="Latência p50" value={`${formatNumber(percentile(lat, 50), 0)} ms`} />
          <SmallStat label="Latência p95" value={`${formatNumber(percentile(lat, 95), 0)} ms`} />
          <SmallStat label="Erros" value={String(ex.filter((e) => e.result === 'erro').length)} />
          <SmallStat label="Transbordos para humano" value={String(ex.filter((e) => e.result === 'transbordo').length)} />
          <SmallStat label="Bloqueadas por guardrail" value={String(ex.filter((e) => e.result === 'bloqueado').length)} />
        </div>
      </Card>
      <MetricGrid metrics={metricsOf(ws, 'operacao')} />
    </div>
  );
}

export function AgenticaView() {
  const ws = useWs();
  const top = [...ws.components].filter((c) => c.status !== 'rascunho').sort((a, b) => b.consumers - a.consumers).slice(0, 8);
  const ex = ws.executions;
  const resolved = ex.filter((e) => e.result === 'sucesso');
  return (
    <div className="space-y-4">
      <MetricGrid metrics={metricsOf(ws, 'agentica')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Boxes} title="Uso de componentes" subtitle="Consumidores por componente do Catálogo" />
          <div className="px-2 pb-2">
            <EChart
              height={260}
              option={{
                grid: { left: 8, right: 24, top: 8, bottom: 8 },
                tooltip: { trigger: 'item' },
                xAxis: { type: 'value' },
                yAxis: { type: 'category', data: top.map((c) => c.name).reverse(), axisLabel: { color: colors['text-muted'], width: 160, overflow: 'truncate' } },
                series: [{ type: 'bar', data: top.map((c, i) => ({ value: c.consumers, itemStyle: { color: i % 2 ? colors.accent : colors.primary, borderRadius: [0, 6, 6, 0] } })).reverse(), barWidth: 12 }],
              }}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Custo e tokens na amostra" subtitle="Por execução e por resolução" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <SmallStat label="Tokens por execução" value={formatNumber(ex.reduce((a, e) => a + e.tokens, 0) / Math.max(1, ex.length), 0)} />
            <SmallStat label="Custo por execução" value={formatBRL(ex.reduce((a, e) => a + e.costBRL, 0) / Math.max(1, ex.length))} />
            <SmallStat label="Custo por resolução" value={formatBRL(ex.reduce((a, e) => a + e.costBRL, 0) / Math.max(1, resolved.length))} hint="custo total ÷ execuções resolvidas sem humano" />
            <SmallStat label="Guardrails acionados" value={String(ex.filter((e) => e.guardrail).length)} hint="veja os traces na aba Traces" />
          </div>
        </Card>
      </div>
    </div>
  );
}

const LICENSE_CAPACITY = 25_000_000;

export function EngenhariaView() {
  const ws = useWs();
  const ms = metricsOf(ws, 'engenharia');
  const linhas = ws.metrics.find((m) => m.id.endsWith('-m-linhas-oc'));
  const mcp = ws.metrics.find((m) => m.id.endsWith('-m-chamadas-mcp'));
  const latestLines = linhas ? linhas.points[linhas.points.length - 1].value : 0;
  const orders = [...ws.buildOrders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const reviewed = ws.components.filter((c) => c.approvals.length > 0);
  const firstTry = reviewed.filter((c) => c.approvals[0].decision === 'aprovado').length;
  const firstTryPct = reviewed.length ? (firstTry / reviewed.length) * 100 : 0;
  const mcpMonth = mcp ? mcp.points.slice(-30).reduce((a, p) => a + p.value, 0) : 0;
  const ocTokens = ws.buildOrders.reduce((a, o) => a + (o.tokens ?? 0), 0);
  const used = ocTokens + mcpMonth * 1200 + 9_400_000;
  const usedPct = (used / LICENSE_CAPACITY) * 100;
  const journeyName = (id: string) => ws.journeys.find((j) => j.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <MetricGrid metrics={ms} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Code2} title="Uso do MCP do Córtex" subtitle="IDEs conectadas e ferramentas disponíveis" />
          <div className="space-y-2 p-4">
            {ws.ideConnections.length === 0 && <EmptyState title="Nenhuma IDE conectada" description="Conecte o Claude Code ou outra IDE em IDEs & MCP." />}
            {ws.ideConnections.map((c) => {
              const user = ws.users.find((u) => u.id === c.userId);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-field border border-border bg-surface-2/40 px-3 py-2 text-sm">
                  <Chip tone="green">{c.ide === 'claude_code' ? 'Claude Code' : c.ide === 'cursor' ? 'Cursor' : c.ide === 'vscode_copilot' ? 'VS Code + Copilot' : 'JetBrains'}</Chip>
                  <span className="flex-1">{user?.name ?? c.userId} · <Mono className="text-text-muted">{c.project}</Mono></span>
                  <span className="text-xs text-text-muted">{c.tools.length} ferramentas · última chamada {fmtDateTime(c.lastCallAt)}</span>
                </div>
              );
            })}
            {mcp && (
              <div className="pt-1 text-xs text-text-muted">
                {formatNumber(mcpMonth, 0)} chamadas MCP nos últimos 30 dias · <DeltaLabel {...seriesDelta(mcp)} />
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader icon={Gauge} title="Capacidade da licença" subtitle="Claude Code na licença do usuário, sem chave de API" />
          <div className="space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-primary">{formatNumber(usedPct, 0)}%</span>
              <span className="text-xs text-text-muted">{formatNumber(used / 1e6, 1)} mi de {formatNumber(LICENSE_CAPACITY / 1e6, 0)} mi tokens/mês</span>
            </div>
            <Progress value={usedPct} tone={usedPct > 85 ? 'yellow' : 'green'} />
            <SmallStat label="Homologação na primeira tentativa" value={`${formatNumber(firstTryPct, 0)}%`} hint={`${firstTry} de ${reviewed.length} componentes revisados pelo CoE AI`} />
            <DemoNote>Dados de demonstração.</DemoNote>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader icon={Hammer} title="Tokens e linhas por OC" subtitle="Vindos do OpenTelemetry do Claude Code, associados a cada ordem de construção" />
        <div className="p-4">
          <Table
            dense
            rows={orders}
            rowKey={(o) => o.id}
            empty={<EmptyState title="Nenhuma OC ainda" description="Envie uma jornada para construção no Studio para ver tokens e linhas aqui." />}
            columns={[
              { key: 'id', header: 'OC', render: (o) => <Mono>{o.id.toUpperCase()}</Mono> },
              { key: 'j', header: 'Jornada', render: (o) => <Link className="hover:text-primary" href={`/jornadas/studio?id=${o.journeyId}`}>{journeyName(o.journeyId)} <span className="text-text-muted">{o.journeyVersion}</span></Link> },
              { key: 's', header: 'Status', render: (o) => <StatusChip status={o.status === 'concluida' ? 'ok' : o.status === 'pronta_revisao' ? 'em_revisao' : 'processando'} label={OC_STATUS[o.status]} /> },
              { key: 't', header: 'Tokens', render: (o) => (o.tokens ? formatNumber(o.tokens, 0) : '—') },
              { key: 'l', header: 'Linhas', render: (o) => (o.tokens ? formatNumber(o === orders.find((x) => x.tokens) ? latestLines : Math.round(o.tokens / 250), 0) : '—') },
              { key: 'pr', header: 'PR', render: (o) => (o.prUrl ? <a href={o.prUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">abrir</a> : '—') },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

const OC_STATUS = {
  na_fila: 'Na fila',
  plano_registrado: 'Plano registrado',
  em_construcao: 'Em construção',
  pronta_revisao: 'Pronta para revisão',
  concluida: 'Concluída',
} as const;

export function NegocioView() {
  const ws = useWs();
  const ms = metricsOf(ws, 'negocio');
  if (ms.length === 0) return <EmptyState title="Sem KPIs de negócio" description="Defina a métrica de valor da iniciativa para acompanhar aqui." />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">KPIs das jornadas definidos nas iniciativas, contra a linha de base acordada e a meta.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ms.map((m, i) => {
          const k = ws.cockpit.valueKpis.find((x) => x.name === m.name);
          const d = seriesDelta(m);
          const progress = k ? Math.max(0, Math.min(100, ((d.last - k.baseline) / (k.target - k.baseline || 1)) * 100)) : 0;
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-text-muted"><Target className="h-3.5 w-3.5" />{m.name}</div>
              <div className={i % 2 ? 'mt-1 text-2xl font-semibold text-accent' : 'mt-1 text-2xl font-semibold text-primary'}>{fmtValue(d.last, m.unit)}{m.unit !== '%' && m.unit !== 'h' && m.unit !== 'R$' ? <span className="ml-1 text-xs font-normal text-text-muted">{m.unit}</span> : null}</div>
              <div className="mt-1 text-xs"><DeltaLabel pct={d.pct} good={d.good} /></div>
              {k && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Base {fmtValue(k.baseline, m.unit)}</span>
                    <span>Meta {fmtValue(k.target, m.unit)}</span>
                  </div>
                  <Progress value={progress} tone={i % 2 ? 'purple' : 'green'} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {ms.map((m, i) => <SeriesChart key={m.id} m={m} index={i} />)}
      </div>
      <DemoNote>Todos os números são fictícios e identificados como dados de demonstração.</DemoNote>
    </div>
  );
}

export function DadosView() {
  const ws = useWs();
  const byDomain = ws.domains.map((d) => {
    const cs = ws.contracts.filter((c) => c.domainId === d.id);
    const rules = cs.flatMap((c) => c.versions[c.versions.length - 1]?.quality ?? []);
    const failing = rules.filter((r) => r.lastResult === 'falha').length;
    const tables = ws.tables.filter((t) => t.domainId === d.id);
    return { d, contracts: cs.length, rules: rules.length, failing, tables: tables.length };
  }).filter((x) => x.contracts || x.tables);
  return (
    <div className="space-y-4">
      <MetricGrid metrics={metricsOf(ws, 'dados')} />
      <Card>
        <CardHeader icon={Database} title="Incidentes de qualidade por domínio" subtitle="Testes de qualidade dos contratos publicados" />
        <div className="p-4">
          <Table
            dense
            rows={byDomain}
            rowKey={(x) => x.d.id}
            columns={[
              { key: 'd', header: 'Domínio', render: (x) => <Link href="/dados" className="hover:text-primary">{x.d.name}</Link> },
              { key: 'o', header: 'Dono', render: (x) => <span className="text-text-muted">{x.d.owner}</span> },
              { key: 'c', header: 'Contratos', render: (x) => x.contracts },
              { key: 't', header: 'Tabelas', render: (x) => x.tables },
              { key: 'r', header: 'Testes', render: (x) => x.rules },
              { key: 'f', header: 'Incidentes', render: (x) => (x.failing ? <StatusChip status="falha" label={`${x.failing} ${x.failing === 1 ? 'falha' : 'falhas'}`} /> : <StatusChip status="ok" label="Sem incidentes" />) },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
