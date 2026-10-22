'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MetricSeries } from '@cortex/schemas';
import { formatNumber, formatBRL } from '@cortex/engine';
import { colors, chartSeries } from '@cortex/ui';
import { Card, CardHeader, cx } from '@/components/ui';
import { EChart } from '@/components/ui/EChart';

export function fmtValue(v: number, unit: string): string {
  if (unit === 'R$') return formatBRL(v);
  if (unit === '%') return `${formatNumber(v, 1)}%`;
  if (unit === 'ms') return `${formatNumber(v, 0)} ms`;
  if (unit === 'h') return `${formatNumber(v, 1)} h`;
  return formatNumber(v, 2);
}

export function seriesDelta(m: MetricSeries) {
  const pts = m.points;
  const last = pts[pts.length - 1]?.value ?? 0;
  const prev = pts[Math.max(0, pts.length - 8)]?.value ?? last;
  const pct = prev === 0 ? 0 : ((last - prev) / Math.abs(prev)) * 100;
  const good = pct === 0 ? null : (pct > 0) === (m.better === 'up');
  return { last, prev, pct, good };
}

export function DeltaLabel({ pct, good, suffix = 'vs. 7 dias atrás' }: { pct: number; good: boolean | null; suffix?: string }) {
  const Icon = Math.abs(pct) < 0.05 ? Minus : pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cx('inline-flex items-center gap-1', good === null ? 'text-text-muted' : good ? 'text-primary' : 'text-danger')}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {pct > 0 ? '+' : ''}{formatNumber(pct, 1)}% <span className="text-text-muted">{suffix}</span>
      <span className="sr-only">{good === null ? 'estável' : good ? 'melhorou' : 'piorou'}</span>
    </span>
  );
}

export function KpiTile({ m, index }: { m: MetricSeries; index: number }) {
  const d = seriesDelta(m);
  return (
    <Card className="p-4">
      <div className="text-xs text-text-muted">{m.name}</div>
      <div className={cx('mt-1 text-2xl font-semibold leading-tight', index % 2 === 0 ? 'text-primary' : 'text-accent')}>{fmtValue(d.last, m.unit)}</div>
      <div className="mt-0.5 text-[11px] text-text-muted">{m.unit} · {m.better === 'up' ? 'quanto maior, melhor' : 'quanto menor, melhor'}</div>
      <div className="mt-2 text-xs"><DeltaLabel pct={d.pct} good={d.good} /></div>
    </Card>
  );
}

export function SeriesChart({ m, index, height = 220 }: { m: MetricSeries; index: number; height?: number }) {
  const color = chartSeries[index % 2];
  const dates = m.points.map((p) => `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`);
  return (
    <Card>
      <CardHeader title={m.name} subtitle={`90 dias · ${m.unit}${m.baseline !== undefined ? ` · linha de base ${fmtValue(m.baseline, m.unit)}` : ''}`} />
      <div className="px-2 pb-2 pt-1">
        <EChart
          height={height}
          option={{
            grid: { left: 8, right: 16, top: 20, bottom: 8 },
            xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { color: colors['text-muted'], interval: 14 } },
            yAxis: { type: 'value', scale: true },
            tooltip: { trigger: 'axis', valueFormatter: (v) => fmtValue(Number(v), m.unit) },
            series: [
              {
                type: 'line',
                name: m.name,
                data: m.points.map((p) => p.value),
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2, color },
                itemStyle: { color },
                areaStyle: {
                  color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${color}40` }, { offset: 1, color: `${color}00` }] },
                },
                ...(m.baseline !== undefined
                  ? {
                      markLine: {
                        symbol: 'none',
                        silent: true,
                        lineStyle: { color: colors.warning, type: 'dashed', width: 1.5 },
                        label: { color: colors.warning, formatter: 'Linha de base', position: 'insideEndTop' },
                        data: [{ yAxis: m.baseline }],
                      },
                    }
                  : {}),
              },
            ],
          }}
        />
      </div>
    </Card>
  );
}

export function MetricGrid({ metrics }: { metrics: MetricSeries[] }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m, i) => <KpiTile key={m.id} m={m} index={i} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {metrics.map((m, i) => <SeriesChart key={m.id} m={m} index={i} />)}
      </div>
    </>
  );
}
