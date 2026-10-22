'use client';

import { useMemo, useState } from 'react';
import { Radar, CheckCircle2, FlaskConical, Search, Ban } from 'lucide-react';
import type { RadarItem } from '@cortex/schemas';
import { useWs } from '@/lib/store';
import { Card, CardHeader, Chip, EmptyState, cx, type ChipTone } from '@/components/ui';
import { AreaHeader, AreaSelector, GenericArtifact } from './BusinessView';

const QUADRANTS: { id: RadarItem['quadrant']; label: string }[] = [
  { id: 'tecnicas', label: 'Técnicas' },
  { id: 'plataformas', label: 'Plataformas' },
  { id: 'ferramentas', label: 'Ferramentas' },
  { id: 'linguagens', label: 'Linguagens' },
];
const RINGS: { id: RadarItem['ring']; label: string; color: string; tone: ChipTone; icon: typeof CheckCircle2 }[] = [
  { id: 'adotar', label: 'Adotar', color: '#00FF95', tone: 'green', icon: CheckCircle2 },
  { id: 'experimentar', label: 'Experimentar', color: '#66FFBF', tone: 'lilac', icon: FlaskConical },
  { id: 'avaliar', label: 'Avaliar', color: '#A07EFC', tone: 'purple', icon: Search },
  { id: 'evitar', label: 'Evitar', color: '#FF7A9A', tone: 'red', icon: Ban },
];

const S = 440;
const C = S / 2;
const RADII = [70, 125, 170, 210];

function placeItems(items: RadarItem[]) {
  // Quadrantes: técnicas (sup. esq.), plataformas (sup. dir.), ferramentas (inf. esq.), linguagens (inf. dir.).
  const base: Record<RadarItem['quadrant'], number> = { tecnicas: 180, plataformas: 270, ferramentas: 90, linguagens: 0 };
  return items.map((it, idx) => {
    const ri = RINGS.findIndex((r) => r.id === it.ring);
    const peers = items.filter((x) => x.quadrant === it.quadrant && x.ring === it.ring);
    const k = peers.indexOf(it);
    const inner = ri === 0 ? 18 : RADII[ri - 1];
    const outer = RADII[ri];
    const r = inner + (outer - inner) * (peers.length > 1 ? 0.35 + 0.3 * (k % 2) : 0.55);
    const span = 90 - 24;
    const ang = base[it.quadrant] + 12 + (span * (k + 1)) / (peers.length + 1);
    const rad = (ang * Math.PI) / 180;
    return { it, n: idx + 1, x: C + r * Math.cos(rad), y: C + r * Math.sin(rad), color: RINGS[ri].color };
  });
}

export function TechRadar() {
  const ws = useWs();
  const [hover, setHover] = useState<number | null>(null);
  const points = useMemo(() => placeItems(ws.radar), [ws.radar]);
  return (
    <Card>
      <CardHeader icon={Radar} title="Radar de tecnologia" subtitle="Resume a stack aprovada e alimenta as políticas de governança" />
      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[440px]" role="img" aria-label="Radar de tecnologia com quatro quadrantes e quatro anéis">
          {[...RADII].reverse().map((r, i) => (
            <circle key={r} cx={C} cy={C} r={r} fill={i % 2 === 0 ? '#1A0D33' : '#21143F'} stroke="#3A2560" />
          ))}
          <line x1={C} y1={C - RADII[3]} x2={C} y2={C + RADII[3]} stroke="#3A2560" strokeWidth={2} />
          <line x1={C - RADII[3]} y1={C} x2={C + RADII[3]} y2={C} stroke="#3A2560" strokeWidth={2} />
          {RINGS.map((r, i) => (
            <text key={r.id} x={C + 4} y={C - (i === 0 ? 40 : (RADII[i - 1] + RADII[i]) / 2) + 4} fill="#A99FB8" fontSize={11}>{r.label}</text>
          ))}
          {QUADRANTS.map((q, i) => {
            const pos = [
              { x: 8, y: 16, a: 'start' },
              { x: S - 8, y: 16, a: 'end' },
              { x: 8, y: S - 8, a: 'start' },
              { x: S - 8, y: S - 8, a: 'end' },
            ][i];
            return <text key={q.id} x={pos.x} y={pos.y} fill="#CFC4F2" fontSize={13} fontWeight={600} textAnchor={pos.a as 'start' | 'end'}>{q.label}</text>;
          })}
          {points.map((p) => (
            <g key={p.n} onMouseEnter={() => setHover(p.n)} onMouseLeave={() => setHover(null)} className="cursor-default">
              <circle cx={p.x} cy={p.y} r={hover === p.n ? 12 : 10} fill={p.color} fillOpacity={0.18} stroke={p.color} strokeWidth={1.5} style={{ filter: hover === p.n ? `drop-shadow(0 0 6px ${p.color})` : undefined }} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#E6E1F5">{p.n}</text>
              <title>{`${p.it.name} · ${RINGS.find((r) => r.id === p.it.ring)!.label}`}</title>
            </g>
          ))}
        </svg>
        <div className="grid gap-4 sm:grid-cols-2">
          {QUADRANTS.map((q) => (
            <div key={q.id}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-soft">{q.label}</div>
              <ul className="space-y-1.5">
                {points.filter((p) => p.it.quadrant === q.id).map((p) => {
                  const ring = RINGS.find((r) => r.id === p.it.ring)!;
                  return (
                    <li
                      key={p.n}
                      onMouseEnter={() => setHover(p.n)}
                      onMouseLeave={() => setHover(null)}
                      className={cx('flex items-start gap-2 rounded-field px-1.5 py-1 text-sm', hover === p.n && 'bg-surface-2')}
                    >
                      <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-text-muted">{p.n}</span>
                      <span className="min-w-0 flex-1">{p.it.name}</span>
                      <Chip tone={ring.tone} icon={ring.icon}>{ring.label}</Chip>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function TechView({ area, onArea }: { area: string; onArea: (id: string) => void }) {
  const ws = useWs();
  const arts = ws.artifacts.filter((a) => a.areaId === area);
  return (
    <div className="space-y-4">
      <AreaSelector side="tecnico" value={area} onChange={onArea} />
      <AreaHeader areaId={area} />
      {arts.length === 0 ? (
        <EmptyState title="Área ainda sem padrões" description="ADRs, stacks e controles homologados aparecem aqui e acendem a área no mapa." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {arts.map((a) => <GenericArtifact key={a.id} a={a} tone="green" />)}
        </div>
      )}
      <TechRadar />
    </div>
  );
}
