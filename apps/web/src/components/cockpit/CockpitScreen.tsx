'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Cpu, FlaskConical, Gauge, Network, ShieldAlert, Sparkles, Target, Users, Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { CockpitKpi, InitiativeStage, WorkspaceData } from '@cortex/schemas';
import { INITIATIVE_STAGES } from '@cortex/schemas';
import { DEMO_IDS } from '@cortex/seed';
import { formatBRL, formatNumber } from '@cortex/engine';
import { useCortex, useEnv, useFlag, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { Card, CardHeader, Chip, EmptyState, EnvBadge, PageHeader, Progress, cx, type ChipTone } from '@/components/ui';
import { EChart } from '@/components/ui/EChart';
import { EcosystemMap, ecosystemModel } from './EcosystemMap';

const FLAG = 'cockpit-antes';

function fmtUnit(n: number, unit: string) {
  if (unit === 'R$') return formatBRL(n).replace(',00', '');
  if (unit === '%') return `${formatNumber(n, 1)}%`;
  return `${formatNumber(n, 1)} ${unit}`;
}

function short(n: number) {
  if (n >= 1_000_000) return `R$ ${formatNumber(n / 1_000_000, 1)} mi`;
  if (n >= 1_000) return `R$ ${formatNumber(n / 1_000, 0)} mil`;
  return formatBRL(n);
}

function KpiCard({ k, before }: { k: CockpitKpi; before: boolean }) {
  const improved = k.better === 'up' ? k.current > k.baseline : k.current < k.baseline;
  const delta = k.current - k.baseline;
  const span = k.target - k.baseline;
  const pct = span === 0 ? 100 : Math.round(((k.current - k.baseline) / span) * 100);
  const Up = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className={cx('p-4 transition-all duration-200', !before && improved && 'border-primary/30')}>
      <div className="truncate text-xs font-medium text-text-muted" title={k.name}>{k.name}</div>
      <div className={cx('mt-2 text-[32px] font-semibold leading-none transition-colors duration-200', before ? 'text-text' : 'text-primary')}>
        {fmtUnit(k.current, k.unit)}
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs">
        {before ? (
          <span className="text-text-muted">Linha de base, sem o Córtex</span>
        ) : (
          <>
            <Up className={cx('h-3.5 w-3.5', improved ? 'text-primary' : 'text-danger')} strokeWidth={2} />
            <span className="text-text">{delta > 0 ? '+' : ''}{formatNumber(delta, 1)}</span>
            <span className="text-text-muted">vs linha de base ({fmtUnit(k.baseline, k.unit)})</span>
          </>
        )}
      </div>
      <div className="mt-3">
        <Progress value={Math.max(0, pct)} tone={before ? 'purple' : 'green'} />
        <div className="mt-1 flex justify-between text-[11px] text-text-muted">
          <span>Meta: {fmtUnit(k.target, k.unit)}</span>
          <span>{Math.max(0, Math.min(100, pct))}% do caminho</span>
        </div>
      </div>
    </Card>
  );
}

const SEV: Record<'alta' | 'media' | 'baixa', { tone: ChipTone; label: string; icon: LucideIcon }> = {
  alta: { tone: 'red', label: 'Alta', icon: ShieldAlert },
  media: { tone: 'yellow', label: 'Média', icon: AlertTriangle },
  baixa: { tone: 'muted', label: 'Baixa', icon: AlertTriangle },
};

interface RiskItem { id: string; kind: 'politica' | 'conector' | 'aprovacao'; title: string; severity: 'alta' | 'media' | 'baixa'; href: string }

function liveRisks(ws: WorkspaceData): RiskItem[] {
  const ids = DEMO_IDS[ws.workspace.industry];
  const out: RiskItem[] = [];
  const anchor = ws.journeys.find((j) => j.id === ids.anchorJourneyId);
  const devV = anchor?.versions.find((v) => v.version === anchor.envVersions.dev) ?? anchor?.versions[anchor.versions.length - 1];
  if (anchor && devV && !devV.graph.nodes.some((n) => n.kind === 'guardrail.pii')) {
    out.push({ id: 'pii', kind: 'politica', severity: 'alta', title: `"${anchor.name}" em Dev envia dado pessoal ao canal sem filtro de PII`, href: `/jornadas/studio?id=${anchor.id}` });
  }
  ws.connectors
    .filter((c) => c.status === 'degradado' || c.status === 'erro')
    .forEach((c) => out.push({ id: c.id, kind: 'conector', severity: c.status === 'erro' ? 'alta' : 'media', title: `Conector "${c.name}" ${c.status === 'erro' ? 'com erro' : 'degradado: latência acima do limite'}`, href: '/conectores' }));
  ws.approvals
    .filter((a) => a.status === 'pendente')
    .slice(0, 3)
    .forEach((a) => out.push({ id: a.id, kind: 'aprovacao', severity: a.kind === 'promocao' ? 'media' : 'baixa', title: `${a.title}: aprovação parada`, href: '/governanca' }));
  return out;
}

const KIND_LABEL = { politica: 'Política', conector: 'Conector', aprovacao: 'Aprovação' } as const;

export function CockpitScreen() {
  const ws = useWs();
  const env = useEnv();
  const before = useFlag(FLAG);
  const setFlag = useCortex((s) => s.setFlag);
  const data = before ? ws.cockpitBefore : ws.cockpit;

  const setMode = (antes: boolean) => {
    if (antes === before) return;
    setFlag(FLAG, antes);
    emitTourAction('cockpit.alternar');
  };

  useAutoAction('cockpit.alternar', async () => {
    // Termina sempre em "com o Córtex": se já estiver, mostra o antes primeiro.
    if (!useCortex.getState().flags[ws.workspace.id]?.[FLAG]) {
      setFlag(FLAG, true);
      await sleep(1600);
    }
    await sleep(400);
    setFlag(FLAG, false);
    await sleep(300);
    emitTourAction('cockpit.alternar');
  });

  // Funil: "com" lê as iniciativas vivas; "antes" usa a linha de base do seed.
  const funnel = useMemo(() => {
    if (before) return ws.cockpitBefore.funnel;
    return INITIATIVE_STAGES.map((s) => {
      const xs = ws.initiatives.filter((i) => i.stage === s.id);
      return { stage: s.id as InitiativeStage, count: xs.length, valueBRL: xs.reduce((a, i) => a + i.expectedValueBRL, 0) };
    });
  }, [before, ws.initiatives, ws.cockpitBefore.funnel]);
  const funnelTotal = funnel.reduce((a, f) => a + f.valueBRL, 0);
  const stageLabel = (s: string) => INITIATIVE_STAGES.find((x) => x.id === s)?.label ?? s;

  const risks: RiskItem[] = before
    ? ws.cockpitBefore.risks.map((r) => ({ ...r, href: r.kind === 'conector' ? '/conectores' : '/governanca' }))
    : liveRisks(ws);

  const stats = useMemo(() => ecosystemModel(ws, env, before).stats, [ws, env, before]);

  const eng = data.engineering;
  const engOption = {
    grid: { left: 8, right: 56, top: 28, bottom: 8, containLabel: true },
    legend: { data: before ? ['Hoje'] : ['Antes do Córtex', 'Com o Córtex'] },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (ps: unknown) => {
        const arr = ps as { dataIndex: number }[];
        const e = eng[arr[0]?.dataIndex ?? 0];
        if (!e) return '';
        return `${e.label}<br/>Antes: ${fmtUnit(e.before, e.unit)}${before ? '' : `<br/>Com o Córtex: ${fmtUnit(e.after, e.unit)}`}`;
      },
    },
    xAxis: { type: 'value' as const, show: false, max: Math.max(...eng.map((e) => Math.max(100, (e.after / (e.before || 1)) * 100))) * 1.1 },
    yAxis: { type: 'category' as const, inverse: true, data: eng.map((e) => e.label), axisLabel: { width: 150, overflow: 'truncate' as const } },
    series: before
      ? [{ name: 'Hoje', type: 'bar' as const, barWidth: 10, itemStyle: { color: '#A07EFC', borderRadius: 5 }, data: eng.map(() => 100), label: { show: true, position: 'right' as const, color: '#A99FB8', formatter: (p: unknown) => fmtUnit(eng[(p as { dataIndex: number }).dataIndex].before, eng[(p as { dataIndex: number }).dataIndex].unit) } }]
      : [
          { name: 'Antes do Córtex', type: 'bar' as const, barWidth: 8, itemStyle: { color: '#A07EFC', borderRadius: 4 }, data: eng.map(() => 100) },
          {
            name: 'Com o Córtex', type: 'bar' as const, barWidth: 8, itemStyle: { color: '#00FF95', borderRadius: 4 },
            data: eng.map((e) => Math.round((e.after / (e.before || 1)) * 100)),
            label: { show: true, position: 'right' as const, color: '#E6E1F5', formatter: (p: unknown) => { const e = eng[(p as { dataIndex: number }).dataIndex]; return fmtUnit(e.after, e.unit); } },
          },
        ],
  };

  const funnelOption = {
    grid: { left: 8, right: 90, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (ps: unknown) => {
        const f = funnel[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
        return f ? `${stageLabel(f.stage)}<br/>${f.count} iniciativas<br/>${formatBRL(f.valueBRL).replace(',00', '')} esperados` : '';
      },
    },
    xAxis: { type: 'value' as const, show: false },
    yAxis: { type: 'category' as const, inverse: true, data: funnel.map((f) => `${stageLabel(f.stage)} (${f.count})`) },
    series: [{
      type: 'bar' as const, barWidth: 14,
      data: funnel.map((f, i) => ({ value: f.valueBRL, itemStyle: { color: i % 2 ? '#A07EFC' : '#00FF95', borderRadius: 7 } })),
      label: { show: true, position: 'right' as const, color: '#E6E1F5', formatter: (p: unknown) => short((p as { value: number }).value) },
    }],
  };

  const ADOPTION_ICON: LucideIcon[] = [Users, Cpu, Waypoints, Sparkles];

  return (
    <div className="showcase-bg min-h-full">
      <PageHeader
        title="Cockpit executivo"
        subtitle={`Quanto valor, quanta adoção e quanto risco na ${ws.workspace.company}, em uma vista.`}
        actions={
          <>
            <Chip tone="yellow" icon={FlaskConical}>Dados de demonstração</Chip>
            <div data-tour="cockpit-antes-depois" role="radiogroup" aria-label="Comparação" className="flex rounded-full border border-border bg-surface-1 p-0.5">
              {[{ v: true, label: 'Antes do Córtex' }, { v: false, label: 'Com o Córtex' }].map((o) => (
                <button
                  key={o.label}
                  role="radio"
                  aria-checked={before === o.v}
                  onClick={() => setMode(o.v)}
                  className={cx(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                    before === o.v ? (o.v ? 'bg-accent text-white shadow-halo-purple' : 'bg-primary text-on-primary shadow-halo-green') : 'text-text-muted hover:text-text',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {/* Valor gerado */}
      <section data-tour="cockpit-kpis" className="mb-4 rounded-card">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold">Valor gerado</h2>
          <span className="text-xs text-text-muted">
            {before ? 'Indicadores de negócio hoje, sem o cérebro' : 'KPIs das jornadas em Prd contra a linha de base acordada'}
          </span>
        </div>
        {data.valueKpis.length ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {data.valueKpis.map((k) => (
              <KpiCard key={k.name} k={k} before={before} />
            ))}
          </div>
        ) : (
          <EmptyState title="Sem KPIs de valor" description="Os KPIs aparecem quando a primeira jornada chega a Prd com linha de base acordada." />
        )}
      </section>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        {/* Ecossistema */}
        <Card data-tour="cockpit-ecossistema" className="xl:col-span-2" halo={before ? undefined : 'green'}>
          <CardHeader
            icon={Network}
            title="Ecossistema"
            subtitle={before ? 'Antes do Córtex: cada sistema é uma ilha, sem ligação entre si' : 'Sistemas, conectores, canais e jornadas ligados pelo cérebro'}
            actions={<span className="inline-flex items-center gap-1 text-xs text-text-muted">Jornadas em <EnvBadge env={env} /></span>}
          />
          <div className="p-3">
            <EcosystemMap ws={ws} env={env} before={before} height={380} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone={before ? 'muted' : 'green'}>{stats.connected} de {stats.systems} sistemas conectados</Chip>
              <Chip tone={before ? 'muted' : 'lilac'}>{stats.activeChannels} de {stats.channels} canais ligados</Chip>
              <Chip tone={before ? 'muted' : 'purple'}>{stats.journeys} jornadas no ambiente</Chip>
              {!before && stats.connected < stats.systems && (
                <Link href="/conectores" className="inline-flex items-center gap-1 text-xs text-primary-soft hover:underline">
                  Conectar as ilhas restantes <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </Card>

        {/* Riscos e alertas */}
        <Card halo={risks.some((r) => r.severity === 'alta') ? 'red' : undefined}>
          <CardHeader icon={ShieldAlert} title="Riscos e alertas" subtitle="Políticas violadas, conectores degradados, aprovações paradas" />
          <div className="p-3">
            {risks.length ? (
              <ul className="space-y-2">
                {risks.map((r) => (
                  <li key={r.id}>
                    <Link href={r.href} className="block rounded-field border border-border bg-surface-2 p-3 transition-colors hover:border-accent">
                      <div className="flex items-center justify-between gap-2">
                        <Chip tone={SEV[r.severity].tone} icon={SEV[r.severity].icon}>{SEV[r.severity].label}</Chip>
                        <span className="text-[11px] text-text-muted">{KIND_LABEL[r.kind]}</span>
                      </div>
                      <div className="mt-1.5 text-sm">{r.title}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhum risco aberto" description="Políticas, conectores e aprovações estão em dia neste workspace." />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Portfólio */}
        <Card>
          <CardHeader
            icon={Waypoints}
            title="Portfólio de iniciativas"
            subtitle={`${funnel.reduce((a, f) => a + f.count, 0)} iniciativas · ${short(funnelTotal)} esperados`}
            actions={<Link href="/iniciativas" className="text-xs text-primary-soft hover:underline">Abrir</Link>}
          />
          <div className="p-3">
            <EChart option={funnelOption} height={220} />
          </div>
        </Card>

        {/* Adoção */}
        <Card>
          <CardHeader icon={Users} title="Adoção" subtitle="Quem usa o cérebro e quanto se reaproveita" />
          <div className="grid grid-cols-2 gap-3 p-4">
            {data.adoption.map((a, i) => {
              const Icon = ADOPTION_ICON[i % ADOPTION_ICON.length];
              return (
                <div key={a.label} className="rounded-field border border-border bg-surface-2 p-3">
                  <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  <div className={cx('mt-2 text-2xl font-semibold', before ? 'text-text' : 'text-primary')}>{a.value}</div>
                  <div className="text-xs text-text-muted">{a.label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Engenharia */}
        <Card>
          <CardHeader icon={Gauge} title="Engenharia" subtitle={before ? 'Cadeia de entrega hoje' : 'Produtividade e custo da cadeia sobre a linha de base'} />
          <div className="p-3">
            <EChart option={engOption} height={220} />
          </div>
        </Card>
      </div>
    </div>
  );
}
