'use client';

import dynamic from 'next/dynamic';
import { colors, chartSeries } from '@cortex/ui';
import type { EChartsOption } from 'echarts';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** Tema escuro do Córtex: séries verde/roxo, grade em border, tooltip escuro. */
export const chartBase: EChartsOption = {
  backgroundColor: 'transparent',
  color: [...chartSeries],
  textStyle: { fontFamily: 'Poppins, sans-serif', color: colors['text-muted'], fontSize: 12 },
  grid: { left: 40, right: 16, top: 24, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: colors['surface-1'],
    borderColor: colors.border,
    textStyle: { color: colors.text, fontSize: 12 },
  },
  legend: { textStyle: { color: colors['text-muted'] }, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
  xAxis: { axisLine: { lineStyle: { color: colors.border } }, splitLine: { show: false }, axisLabel: { color: colors['text-muted'] } },
  yAxis: { axisLine: { show: false }, splitLine: { lineStyle: { color: colors.border, opacity: 0.6 } }, axisLabel: { color: colors['text-muted'] } },
};

/** Mescla raso das chaves de primeiro nível com o tema base. */
export function EChart({ option, height = 240, className }: { option: EChartsOption; height?: number; className?: string }) {
  const merged: EChartsOption = { ...chartBase, ...option };
  for (const k of ['grid', 'tooltip', 'legend', 'textStyle'] as const) {
    if (option[k] && !Array.isArray(option[k])) merged[k] = { ...(chartBase[k] as object), ...(option[k] as object) } as never;
  }
  for (const k of ['xAxis', 'yAxis'] as const) {
    const o = option[k];
    if (o && !Array.isArray(o)) merged[k] = { ...(chartBase[k] as object), ...(o as object) } as never;
  }
  return <ReactECharts option={merged} style={{ height }} className={className} notMerge lazyUpdate opts={{ renderer: 'svg' }} />;
}
