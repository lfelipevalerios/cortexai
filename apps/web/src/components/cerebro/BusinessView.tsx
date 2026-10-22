'use client';

import { type MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookMarked, Boxes, CalendarDays, ChevronRight, Frown, Gauge, Radio, Scale, Target, Workflow, Brain } from 'lucide-react';
import type { BrainArtifact, WorkspaceData } from '@cortex/schemas';
import { useWs } from '@/lib/store';
import { Card, Chip, EmptyState, Mono, Progress, StatusChip, cx } from '@/components/ui';
import { AREA_ICON } from './BrainMap';
import { DecisionTableView, type DecisionTableApi } from './DecisionTableView';
import { computeAreaStats, journeysUsingTable } from './lib';

export function AreaSelector({ side, value, onChange }: { side: 'negocio' | 'tecnico'; value: string; onChange: (id: string) => void }) {
  const ws = useWs();
  const stats = computeAreaStats(ws).filter((s) => s.area.side === side);
  const tone = side === 'negocio' ? 'accent' : 'primary';
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {stats.map((s) => {
        const Icon = AREA_ICON[s.area.id] ?? Brain;
        const active = value === s.area.id;
        return (
          <button
            key={s.area.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.area.id)}
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              active
                ? tone === 'accent'
                  ? 'border-accent bg-accent/15 text-text shadow-halo-purple'
                  : 'border-primary bg-primary/10 text-text shadow-halo-green'
                : 'border-border text-text-muted hover:border-accent hover:text-text',
            )}
          >
            <Icon className={cx('h-4 w-4', tone === 'accent' ? 'text-accent' : 'text-primary')} strokeWidth={1.5} />
            {s.area.name}
            <span className="font-mono text-[11px] text-text-muted">{s.coverage}%</span>
          </button>
        );
      })}
    </div>
  );
}

export function AreaHeader({ areaId }: { areaId: string }) {
  const ws = useWs();
  const s = computeAreaStats(ws).find((x) => x.area.id === areaId);
  if (!s) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{s.area.name}</div>
        <div className="text-xs text-text-muted">{s.area.description} Dono: {s.area.owner}.</div>
      </div>
      <div className="flex w-56 items-center gap-3">
        <Progress value={s.coverage} tone={s.area.side === 'negocio' ? 'purple' : 'green'} />
        <span className="font-mono text-xs">{s.coverage}%</span>
      </div>
    </div>
  );
}

function metric(a: BrainArtifact, label: string) {
  return a.metrics?.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value;
}

function CatalogLink({ id }: { id?: string }) {
  const ws = useWs();
  const router = useRouter();
  if (!id) return null;
  const c = ws.components.find((x) => x.id === id);
  if (!c) return null;
  return (
    <button onClick={() => router.push(`/catalogo?id=${encodeURIComponent(id)}`)} className="inline-flex items-center gap-1 rounded-full text-xs text-primary-soft hover:underline">
      <Boxes className="h-3.5 w-3.5" /> {c.name} <Mono>{c.version}</Mono>
    </button>
  );
}

function OkrCard({ a }: { a: BrainArtifact }) {
  const atual = metric(a, 'Atual');
  const meta = metric(a, 'Meta');
  const n = (s?: string) => (s ? Number(s.replace(/[^\d,.-]/g, '').replace(',', '.')) : NaN);
  const pct = Number.isFinite(n(atual)) && Number.isFinite(n(meta)) && n(meta) !== 0 ? Math.round((n(atual) / n(meta)) * 100) : null;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-accent"><Target className="h-[18px] w-[18px]" strokeWidth={1.5} /></span>
        <div className="min-w-0 flex-1">
          <Chip tone="purple">{a.kind}</Chip>
          <div className="mt-1.5 text-sm font-semibold">{a.title}</div>
          <p className="mt-1 text-xs text-text-muted">{a.summary}</p>
        </div>
      </div>
      {(atual || meta) && (
        <div className="mt-4 flex items-end gap-6">
          {atual && <div><div className="text-2xl font-semibold leading-none text-primary">{atual}</div><div className="mt-1 text-xs text-text-muted">atual</div></div>}
          {meta && <div><div className="text-2xl font-semibold leading-none text-text">{meta}</div><div className="mt-1 text-xs text-text-muted">meta</div></div>}
          {pct !== null && <div className="flex-1 pb-1"><Progress value={pct} tone="purple" /><div className="mt-1 text-right text-[11px] text-text-muted">{pct}% da meta</div></div>}
        </div>
      )}
    </Card>
  );
}

function ProcessCard({ a }: { a: BrainArtifact }) {
  const steps = a.summary.split('→').map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
  return (
    <Card className="p-4 md:col-span-2">
      <div className="flex items-center gap-2">
        <Chip tone="purple" icon={Workflow}>{a.kind}</Chip>
        <span className="text-sm font-semibold">{a.title}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="rounded-field border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs">{s}</span>
            {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-text-muted" />}
          </span>
        ))}
      </div>
    </Card>
  );
}

function MarketCard({ a, onOpenTable }: { a: BrainArtifact; onOpenTable: (id: string) => void }) {
  const ws = useWs();
  const fonte = metric(a, 'Fonte');
  const data = metric(a, 'Data');
  const reg = a.kind.toLowerCase().includes('regula');
  const origin = reg ? ws.decisionTables.find((t) => (a.body ?? '').includes(`"${t.name}"`) || (t.source ?? '').toLowerCase().includes(a.title.toLowerCase())) : undefined;
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <Chip tone={reg ? 'lilac' : 'purple'} icon={reg ? Scale : Gauge}>{a.kind}</Chip>
        {data && <span className="inline-flex items-center gap-1 text-xs text-text-muted"><CalendarDays className="h-3.5 w-3.5" />{data}</span>}
      </div>
      <div className="mt-2 text-sm font-semibold">{a.title}</div>
      <p className="mt-1 flex-1 text-sm text-text-muted">{a.summary}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1"><BookMarked className="h-3.5 w-3.5" />Fonte: {fonte ?? a.body ?? 'interna'}</span>
        {origin && (
          <button onClick={() => onOpenTable(origin.id)} className="inline-flex items-center gap-1 text-primary-soft hover:underline">
            Origina a regra “{origin.name}” <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Card>
  );
}

function parseJourney(summary: string) {
  const [flow, ...rest] = summary.split(/\.\s*Dor:\s*/i);
  const stepsPart = flow.includes(':') ? flow.slice(flow.indexOf(':') + 1) : flow;
  const actor = flow.includes(':') ? flow.slice(0, flow.indexOf(':')).trim() : '';
  return { actor, steps: stepsPart.split('→').map((s) => s.trim().replace(/\.$/, '')).filter(Boolean), pain: rest.join('. ').replace(/\.$/, '') };
}

function JourneyMap({ a }: { a: BrainArtifact }) {
  const { actor, steps, pain } = parseJourney(a.summary);
  const kpi = metric(a, 'KPI');
  const canais = metric(a, 'Canais');
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Chip tone="purple" icon={Workflow}>{a.kind}</Chip>
          <span className="text-sm font-semibold">{a.title}</span>
          {actor && actor.toLowerCase() !== 'etapas' && <Chip tone="muted">{actor}</Chip>}
        </div>
        <div className="flex flex-wrap gap-2">
          {kpi && <Chip tone="green" icon={Gauge}>KPI: {kpi}</Chip>}
          {canais && <Chip tone="lilac" icon={Radio}>{canais}</Chip>}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <ol className="flex min-w-max items-stretch">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center">
              <div className="w-36 rounded-field border border-accent/40 bg-surface-2 px-3 py-2">
                <div className="font-mono text-[11px] text-accent">Etapa {i + 1}</div>
                <div className="mt-0.5 text-xs font-medium capitalize">{s}</div>
              </div>
              {i < steps.length - 1 && <div className="h-px w-5 bg-accent/50" />}
            </li>
          ))}
        </ol>
      </div>
      {pain && (
        <div className="mt-3 flex items-start gap-2 rounded-field border border-danger/30 bg-danger/5 px-3 py-2 text-xs">
          <Frown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" /> <span><b className="font-medium">Dor:</b> {pain}</span>
        </div>
      )}
    </Card>
  );
}

function ProductCard({ a }: { a: BrainArtifact }) {
  const preco = metric(a, 'Preço');
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <Chip tone="purple">{a.kind}</Chip>
        <span className="flex gap-1">{a.tags.slice(0, 2).map((t) => <Chip key={t} tone="muted">{t}</Chip>)}</span>
      </div>
      <div className="mt-2 text-sm font-semibold">{a.title}</div>
      <p className="mt-1 flex-1 text-sm text-text-muted">{a.summary}</p>
      {preco && <div className="mt-3 text-2xl font-semibold text-primary">{preco}</div>}
      {a.metrics?.filter((m) => m.label !== 'Preço').map((m) => (
        <div key={m.label} className="mt-1 text-xs text-text-muted">{m.label}: {m.value}</div>
      ))}
    </Card>
  );
}

export function GenericArtifact({ a, tone = 'purple' }: { a: BrainArtifact; tone?: 'purple' | 'green' }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <Chip tone={tone}>{a.kind}</Chip>
        <CatalogLink id={a.componentId} />
      </div>
      <div className="mt-2 text-sm font-semibold">{a.title}</div>
      <p className="mt-1 text-sm text-text-muted">{a.summary}</p>
      {a.body && <p className="mt-2 rounded-field border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">{a.body}</p>}
      {a.metrics && (
        <div className="mt-2 flex flex-wrap gap-2">
          {a.metrics.map((m) => <Chip key={m.label} tone="muted">{m.label}: {m.value}</Chip>)}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-1 pt-3">
        {a.tags.map((t) => <span key={t} className="font-mono text-[11px] text-text-muted">#{t}</span>)}
      </div>
    </Card>
  );
}

function RulesList({ ws, onOpenTable }: { ws: WorkspaceData; onOpenTable: (id: string) => void }) {
  const others = ws.artifacts.filter((a) => a.areaId === 'area-regras' && a.kind !== 'Tabela de decisão');
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {ws.decisionTables.map((t) => {
          const comp = t.componentId ? ws.components.find((c) => c.id === t.componentId) : undefined;
          const used = journeysUsingTable(ws, t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => onOpenTable(t.id)}
              className="group flex flex-col rounded-card border border-border bg-surface-1 p-4 text-left transition-colors hover:border-accent hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-2">
                <Chip tone="purple" icon={Scale}>Tabela de decisão</Chip>
                <Mono className="text-accent-soft">v{t.version}</Mono>
              </div>
              <div className="mt-2 text-sm font-semibold">{t.name}</div>
              <p className="mt-1 text-sm text-text-muted">{t.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span>{t.inputs.length} entradas · {t.outputs.length} saídas · {t.rows.length} linhas</span>
                <span>· {used} jornada(s)</span>
                {comp ? <StatusChip status={comp.status} /> : <Chip tone="muted">Sem componente</Chip>}
              </div>
              {t.source && <div className="mt-2 truncate text-xs text-text-muted">Origem: {t.source}</div>}
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-soft">
                Abrir e testar <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
      {others.length > 0 && (
        <>
          <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Alçadas, guardrails e exceções</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {others.map((a) => <GenericArtifact key={a.id} a={a} />)}
          </div>
        </>
      )}
    </div>
  );
}

export function BusinessView({
  area, onArea, openTableId, onOpenTable, onCloseTable, tableApiRef,
}: {
  area: string;
  onArea: (id: string) => void;
  openTableId: string | null;
  onOpenTable: (id: string) => void;
  onCloseTable: () => void;
  tableApiRef: MutableRefObject<DecisionTableApi | null>;
}) {
  const ws = useWs();
  const table = openTableId ? ws.decisionTables.find((t) => t.id === openTableId) : undefined;
  const arts = ws.artifacts.filter((a) => a.areaId === area);

  return (
    <div className="space-y-4">
      <AreaSelector side="negocio" value={area} onChange={(id) => { onCloseTable(); onArea(id); }} />
      {table ? (
        <DecisionTableView table={table} apiRef={tableApiRef} onBack={onCloseTable} />
      ) : (
        <>
          <AreaHeader areaId={area} />
          {area === 'area-regras' ? (
            <RulesList ws={ws} onOpenTable={onOpenTable} />
          ) : arts.length === 0 ? (
            <EmptyState title="Área ainda sem conteúdo" description="Quando a área receber objetivos, fichas ou mapas homologados, eles aparecem aqui e o mapa do cérebro acende." icon={Brain} />
          ) : area === 'area-jornadas' ? (
            <div className="space-y-3">{arts.map((a) => <JourneyMap key={a.id} a={a} />)}</div>
          ) : (
            <div className={cx('grid gap-3', area === 'area-empresa' ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3')}>
              {arts.map((a) => {
                if (a.kind === 'OKR') return <OkrCard key={a.id} a={a} />;
                if (a.kind === 'Processo') return <ProcessCard key={a.id} a={a} />;
                if (area === 'area-mercado') return <MarketCard key={a.id} a={a} onOpenTable={onOpenTable} />;
                if (a.kind === 'Produto') return <ProductCard key={a.id} a={a} />;
                return <GenericArtifact key={a.id} a={a} />;
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
