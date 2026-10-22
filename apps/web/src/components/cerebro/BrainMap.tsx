'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain, Building2, TrendingUp, Route, Package, Scale, Network, Database, Code2, Rocket, ShieldCheck,
  Boxes, GitBranch, Users, Activity, Sparkles, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, PROFILES, type PermissionAction } from '@cortex/schemas';
import { relativeTime } from '@cortex/engine';
import { useWs, demoNow } from '@/lib/store';
import { emitTourAction, sleep } from '@/lib/tour-bus';
import { Button, Chip, Modal, cx } from '@/components/ui';
import { computeAreaStats, type AreaStats } from './lib';

export const AREA_ICON: Record<string, LucideIcon> = {
  'area-empresa': Building2,
  'area-mercado': TrendingUp,
  'area-jornadas': Route,
  'area-produtos': Package,
  'area-regras': Scale,
  'area-arquitetura': Network,
  'area-dados': Database,
  'area-engenharia': Code2,
  'area-devops': Rocket,
  'area-seguranca': ShieldCheck,
};

export interface BrainMapApi {
  acender: () => Promise<void>;
}

// Coordenadas do desenho (viewBox 1000 × 560): cartões nas laterais, cérebro ao centro.
const W = 1000;
const H = 560;
const CARD_W = 290;
const CARD_H = 100;
const GAP = 15;
const CX = 500;
const CY = 280;
const R = 100;
const PURPLE = '#A07EFC';
const GREEN = '#00FF95';

function rowY(i: number) {
  return i * (CARD_H + GAP) + CARD_H / 2;
}

function connectorPath(i: number, side: 'left' | 'right') {
  const y = rowY(i);
  const entry = CY + (i - 2) * 28;
  const dy = entry - CY;
  const edge = Math.sqrt(R * R - dy * dy);
  const xv = [360, 330, 0, 330, 360][i];
  if (side === 'left') {
    if (i === 2) return `M${CARD_W},${y} H${CX - edge}`;
    return `M${CARD_W},${y} H${xv} V${entry} H${CX - edge}`;
  }
  const xr = W - xv;
  if (i === 2) return `M${W - CARD_W},${y} H${CX + edge}`;
  return `M${W - CARD_W},${y} H${xr} V${entry} H${CX + edge}`;
}

export function BrainMap({ apiRef, onOpenArea }: { apiRef: MutableRefObject<BrainMapApi | null>; onOpenArea: (areaId: string) => void }) {
  const ws = useWs();
  const router = useRouter();
  const stats = useMemo(() => computeAreaStats(ws), [ws]);
  const left = stats.filter((s) => s.area.side === 'negocio').slice(0, 5);
  const right = stats.filter((s) => s.area.side === 'tecnico').slice(0, 5);

  const [anim, setAnim] = useState<{ values: Record<string, number>; active: string | null } | null>(null);
  const [running, setRunning] = useState(false);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const runningRef = useRef(false);

  const acender = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    const all = statsRef.current;
    const l = all.filter((s) => s.area.side === 'negocio');
    const r = all.filter((s) => s.area.side === 'tecnico');
    const order: AreaStats[] = [];
    for (let i = 0; i < Math.max(l.length, r.length); i++) {
      if (l[i]) order.push(l[i]);
      if (r[i]) order.push(r[i]);
    }
    setAnim({ values: {}, active: null });
    await sleep(450);
    for (const s of order) {
      const steps = 12;
      for (let k = 1; k <= steps; k++) {
        const v = Math.round((s.coverage * k) / steps);
        setAnim((prev) => ({ active: s.area.id, values: { ...(prev?.values ?? {}), [s.area.id]: v } }));
        await sleep(26);
      }
      await sleep(140);
    }
    setAnim((prev) => (prev ? { ...prev, active: null } : prev));
    await sleep(250);
    setAnim(null);
    runningRef.current = false;
    setRunning(false);
    emitTourAction('cerebro.acender');
  }, []);

  useEffect(() => {
    apiRef.current = { acender };
    return () => {
      if (apiRef.current?.acender === acender) apiRef.current = null;
    };
  }, [apiRef, acender]);

  const shown = (s: AreaStats) => (anim ? anim.values[s.area.id] ?? 0 : s.coverage);
  const overall = Math.round(stats.reduce((n, s) => n + shown(s), 0) / Math.max(1, stats.length));
  const published = ws.components.filter((c) => c.status === 'homologado' || c.status === 'publicado_prd').length;

  return (
    <div className="space-y-5">
      <div data-tour="cerebro-mapa" className="showcase-bg overflow-hidden rounded-card border border-border bg-bg/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 text-xs font-medium uppercase tracking-wide">
            <span className="flex items-center gap-2 text-accent"><span className="h-2 w-2 rounded-full bg-accent" />Visão de negócio</span>
            <span className="flex items-center gap-2 text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Padrões técnicos</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">O brilho de cada área acompanha a cobertura.</span>
            <Button size="sm" variant="tertiary" icon={Sparkles} loading={running} onClick={() => void acender()}>
              Acender o mapa
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="relative mx-auto min-w-[880px]" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <radialGradient id="brain-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#21143F" />
                  <stop offset="70%" stopColor="#1A0D33" />
                  <stop offset="100%" stopColor="#0D0020" />
                </radialGradient>
                <linearGradient id="brain-ring" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={PURPLE} />
                  <stop offset="100%" stopColor={GREEN} />
                </linearGradient>
                <filter id="brain-blur" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="18" />
                </filter>
              </defs>

              {left.map((s, i) => (
                <Connector key={s.area.id} d={connectorPath(i, 'left')} color={PURPLE} value={shown(s)} active={anim?.active === s.area.id} />
              ))}
              {right.map((s, i) => (
                <Connector key={s.area.id} d={connectorPath(i, 'right')} color={GREEN} value={shown(s)} active={anim?.active === s.area.id} />
              ))}

              <circle cx={CX} cy={CY} r={R + 8} fill="url(#brain-ring)" opacity={0.15 + (overall / 100) * 0.35} filter="url(#brain-blur)" />
              <circle cx={CX} cy={CY} r={R} fill="url(#brain-core)" stroke="url(#brain-ring)" strokeWidth={2} />
              <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'spin 28s linear infinite' }}>
                <circle cx={CX} cy={CY} r={R - 12} fill="none" stroke="url(#brain-ring)" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 9" />
              </g>
              <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'spin 40s linear infinite reverse' }}>
                <circle cx={CX} cy={CY} r={R + 18} fill="none" stroke="url(#brain-ring)" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="1 7" />
              </g>
            </svg>

            {/* Núcleo */}
            <div
              className="pointer-events-none absolute flex flex-col items-center justify-center text-center"
              style={{ left: `${((CX - R) / W) * 100}%`, top: `${((CY - R) / H) * 100}%`, width: `${((2 * R) / W) * 100}%`, height: `${((2 * R) / H) * 100}%` }}
            >
              <Brain className="h-8 w-8 text-accent-soft" strokeWidth={1.25} />
              <div className="mt-1 text-[28px] font-semibold leading-none text-primary tabular-nums">{overall}%</div>
              <div className="mt-1 text-[11px] leading-tight text-text-muted">cobertura do cérebro</div>
              <div className="mt-1 text-[11px] leading-tight text-accent-soft">{ws.workspace.company}</div>
            </div>

            {left.map((s, i) => (
              <AreaCard key={s.area.id} s={s} index={i} side="left" value={shown(s)} active={anim?.active === s.area.id} onClick={() => onOpenArea(s.area.id)} />
            ))}
            {right.map((s, i) => (
              <AreaCard key={s.area.id} s={s} index={i} side="right" value={shown(s)} active={anim?.active === s.area.id} onClick={() => onOpenArea(s.area.id)} />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          <Chip tone="purple" icon={Scale}>{ws.decisionTables.length} regras em tabela de decisão</Chip>
          <Chip tone="lilac" icon={Database}>{ws.documents.length} documentos de conhecimento</Chip>
          <Chip tone="green" icon={Boxes}>{published} componentes homologados</Chip>
          <Chip tone="muted" icon={Network}>{ws.contracts.length} contratos de dados</Chip>
        </div>
      </div>

      <GovernanceStrip onNavigate={(href) => router.push(href)} />
    </div>
  );
}

function Connector({ d, color, value, active }: { d: string; color: string; value: number; active: boolean }) {
  const o = 0.15 + (value / 100) * 0.75;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeOpacity={o * 0.35} strokeWidth={6} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeOpacity={o}
        strokeWidth={active ? 2.2 : 1.5}
        strokeDasharray={active ? '6 4' : undefined}
        style={active ? { animation: 'dash 0.6s linear infinite' } : undefined}
        className="transition-[stroke-opacity] duration-200"
      />
    </g>
  );
}

function AreaCard({ s, index, side, value, active, onClick }: { s: AreaStats; index: number; side: 'left' | 'right'; value: number; active: boolean; onClick: () => void }) {
  const Icon = AREA_ICON[s.area.id] ?? Brain;
  const rgb = side === 'left' ? '160,126,252' : '0,255,149';
  const k = value / 100;
  const boost = s.boosts.reduce((n, b) => n + b.pp, 0);
  const ratio = s.coverage > 0 ? value / s.coverage : 1;
  const top = index * (CARD_H + GAP);
  const x = side === 'left' ? 0 : W - CARD_W;
  return (
    <button
      onClick={onClick}
      title={s.boosts.length ? `Cresceu com a demo:\n${s.boosts.map((b) => `+${b.pp} pp · ${b.reason}`).join('\n')}` : s.area.description}
      className={cx(
        'absolute flex flex-col justify-between rounded-card border bg-surface-1/95 px-3 py-2 text-left transition-[box-shadow,border-color,opacity] duration-200 hover:bg-surface-2',
        active && 'animate-fade-in',
      )}
      style={{
        left: `${(x / W) * 100}%`,
        top: `${(top / H) * 100}%`,
        width: `${(CARD_W / W) * 100}%`,
        height: `${(CARD_H / H) * 100}%`,
        borderColor: `rgba(${rgb},${0.2 + k * 0.6})`,
        boxShadow: value > 0 ? `0 0 0 1px rgba(${rgb},${0.1 + k * 0.35}), 0 0 ${6 + k * (active ? 40 : 26)}px rgba(${rgb},${0.08 + k * (active ? 0.5 : 0.3)})` : 'none',
        opacity: 0.55 + k * 0.45,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: `rgba(${rgb},.5)`, background: `rgba(${rgb},.1)`, color: `rgb(${rgb})` }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.area.name}</span>
        <span className={cx('text-lg font-semibold tabular-nums', side === 'left' ? 'text-accent' : 'text-primary')}>{value}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-all duration-200" style={{ width: `${value}%`, background: `rgb(${rgb})` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
        <span className="truncate">
          {Math.round(s.artifacts * ratio)} artefatos · {Math.round(s.published * ratio)} publicados
        </span>
        {boost > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary-soft">
            <Sparkles className="h-3 w-3" />+{boost} pp
          </span>
        )}
      </div>
      <div className="truncate text-[11px] text-text-muted">
        {s.area.owner} · {boost > 0 ? 'atualizada agora' : `atualizada ${relativeTime(s.area.updatedAt, demoNow())}`}
      </div>
    </button>
  );
}

function GovernanceStrip({ onNavigate }: { onNavigate: (href: string) => void }) {
  const ws = useWs();
  const [permOpen, setPermOpen] = useState(false);
  const cataloged = ws.components.filter((c) => c.status !== 'rascunho').length;
  const versioned = ws.journeys.filter((j) => Object.values(j.envVersions).some(Boolean)).length;
  const items: { id: string; icon: LucideIcon; label: string; value: string; desc: string; onClick: () => void }[] = [
    { id: 'cat', icon: Boxes, label: 'Catalogado', value: `${cataloged} componentes`, desc: 'Com dono, status e consumidores no Catálogo.', onClick: () => onNavigate('/catalogo') },
    { id: 'ver', icon: GitBranch, label: 'Versionado', value: `${versioned} jornadas`, desc: 'Com versão por ambiente, de Dev a Prd.', onClick: () => onNavigate('/ambientes') },
    { id: 'per', icon: Users, label: 'Perfis & permissões', value: `${Object.keys(PROFILES).length} perfis`, desc: '"Ver como" troca o perfil ao vivo no cabeçalho.', onClick: () => setPermOpen(true) },
    { id: 'med', icon: Activity, label: 'Medido', value: `${ws.metrics.length} indicadores`, desc: `${ws.executions.length} execuções com trace na Telemetria.`, onClick: () => onNavigate('/telemetria') },
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={it.onClick}
            className="group flex items-start gap-3 rounded-card border border-border bg-surface-1 p-4 text-left transition-colors hover:border-accent hover:bg-surface-2"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-accent shadow-[0_0_14px_rgba(160,126,252,.25)]">
              <it.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between text-sm font-semibold">
                {it.label}
                <ChevronRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-0.5 block text-base font-semibold text-text">{it.value}</span>
              <span className="mt-0.5 block text-xs text-text-muted">{it.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <Modal open={permOpen} onClose={() => setPermOpen(false)} title="Perfis & permissões" subtitle="Ações sensíveis e quem pode executá-las neste workspace" width={680}>
        <div className="space-y-2">
          {(Object.keys(PERMISSIONS) as PermissionAction[]).map((a) => (
            <div key={a} className="flex flex-wrap items-center justify-between gap-2 rounded-field border border-border bg-surface-2 px-3 py-2">
              <span className="text-sm font-medium">{PERMISSIONS[a].label}</span>
              <span className="flex flex-wrap gap-1">
                {PERMISSIONS[a].profiles.map((p) => (
                  <Chip key={p} tone="purple" icon={Users}>{PROFILES[p].label}</Chip>
                ))}
                {PERMISSIONS[a].envs && <Chip tone="muted">só em {PERMISSIONS[a].envs!.map((e) => e.toUpperCase()).join(', ')}</Chip>}
              </span>
            </div>
          ))}
          <p className="pt-2 text-xs text-text-muted">Use “Ver como”, no cabeçalho, para entrar com o perfil de outra pessoa e conferir o que ela vê.</p>
        </div>
      </Modal>
    </>
  );
}
