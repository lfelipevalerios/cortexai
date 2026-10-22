'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, History, KeyRound, Layers, Lock, Undo2, Boxes } from 'lucide-react';
import {
  COMPONENT_TYPES, ENV_ORDER, ENVS, type Component, type Connector, type DataContract, type EnvId, type Release,
} from '@cortex/schemas';
import { relativeTime } from '@cortex/engine';
import { demoNow, useWs } from '@/lib/store';
import {
  Card, CardHeader, Chip, EmptyState, EnvBadge, Mono, PageHeader, Select, StatusChip, Table, Tabs, Term, cx,
} from '@/components/ui';
import { JourneyPipeline } from './JourneyPipeline';
import { ENV_WHO, GATES, semverSort } from './util';

export function AmbientesView() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Ambientes & releases"
        subtitle="Cada jornada tem uma versão por ambiente. A promoção passa por gates automáticos e aprovação humana; o rollback volta à versão anterior em um clique, com registro na auditoria."
      />
      <EnvExplainer />
      <JourneyPipeline />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <ReleaseTimeline />
        <EnvInventory />
      </div>
    </div>
  );
}

// ---------- Os três ambientes ----------
function EnvExplainer() {
  const ws = useWs();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {ENV_ORDER.map((env, i) => {
        const journeys = ws.journeys.filter((j) => j.envVersions[env]).length;
        const channels = ws.channels.filter((c) => c.journeyByEnv[env]).length;
        const connectors = ws.connectors.filter((c) => c.envs[env]).length;
        const gate = GATES.find((g) => g.to === env);
        return (
          <Card key={env} className="relative overflow-hidden p-4">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: ENVS[env].color }} aria-hidden />
            <div className="flex items-center justify-between">
              <EnvBadge env={env} />
              <span className="text-[11px] text-text-muted">{i + 1} de 3</span>
            </div>
            <div className="mt-2 text-sm font-semibold">{ENVS[env].purpose}</div>
            <div className="mt-1 text-xs text-text-muted">
              <span className="font-medium text-text">Quem altera:</span> {ENV_WHO[env]}
            </div>
            {gate && (
              <div className="mt-2 rounded-field border border-border bg-surface-2 p-2 text-[11px] leading-relaxed text-text-muted">
                <span className="font-medium text-text"><Term term="gate">Gates</Term> {ENVS[gate.from].label} → {ENVS[gate.to].label}:</span> {gate.gates}. Aprovação: {gate.approval}.
              </div>
            )}
            <div className="mt-3 flex gap-4 text-xs">
              <span><b className="text-base font-semibold" style={{ color: ENVS[env].color }}>{journeys}</b> jornadas</span>
              <span><b className="text-base font-semibold text-text">{channels}</b> canais</span>
              <span><b className="text-base font-semibold text-text">{connectors}</b> credenciais</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- Linha do tempo de releases ----------
const RELEASE_META: Record<Release['status'], { icon: typeof CheckCircle2; tone: string; label: string }> = {
  promovida: { icon: CheckCircle2, tone: 'text-primary border-primary/50 bg-primary/10', label: 'Promovida' },
  bloqueada: { icon: Lock, tone: 'text-danger border-danger/50 bg-danger/10', label: 'Bloqueada' },
  rollback: { icon: Undo2, tone: 'text-warning border-warning/50 bg-warning/10', label: 'Rollback' },
};

function ReleaseTimeline() {
  const ws = useWs();
  const [journeyId, setJourneyId] = useState('todas');
  const releases = useMemo(
    () =>
      [...ws.releases]
        .filter((r) => journeyId === 'todas' || r.journeyId === journeyId)
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
    [ws.releases, journeyId],
  );
  const now = demoNow();
  return (
    <Card>
      <CardHeader
        icon={History}
        title="Histórico de releases"
        subtitle="Promoções, bloqueios e rollbacks, com quem fez e o percentual de tráfego"
        actions={
          <Select
            aria-label="Filtrar por jornada"
            className="h-8 w-48 py-1 text-xs"
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            options={[{ value: 'todas', label: 'Todas as jornadas' }, ...ws.journeys.map((j) => ({ value: j.id, label: j.name }))]}
          />
        }
      />
      <div className="max-h-[460px] overflow-auto p-4">
        {releases.length === 0 ? (
          <EmptyState icon={History} title="Nenhuma release ainda" description="Quando uma jornada for promovida, a release aparece aqui com os gates e quem aprovou." />
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-5">
            {releases.map((r) => {
              const m = RELEASE_META[r.status];
              const Icon = m.icon;
              const j = ws.journeys.find((x) => x.id === r.journeyId);
              return (
                <li key={r.id} className="relative animate-fade-in">
                  <span className={cx('absolute -left-[31px] top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border', m.tone)}>
                    <Icon className="h-3 w-3" strokeWidth={2} />
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-medium">{m.label}</span>
                    <EnvBadge env={r.from} />
                    <ArrowRight className="h-3 w-3 text-text-muted" />
                    <EnvBadge env={r.to} />
                    <Mono className="text-text">{r.version}</Mono>
                    {r.trafficPct !== undefined && <Chip tone={r.trafficPct < 100 ? 'yellow' : 'muted'}>{r.trafficPct}% do tráfego</Chip>}
                  </div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    {j?.name ?? r.journeyId} · {r.by} · {relativeTime(r.at, now)}
                    {r.status === 'bloqueada' && ' · aguardando aprovação humana do gate de Prd'}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}

// ---------- Componentes, contratos e conectores por ambiente ----------
type InvTab = 'componentes' | 'contratos' | 'conectores';

/** Versão do componente visível em cada ambiente, derivada do estágio de homologação. */
function componentEnvVersion(c: Component, env: EnvId): string | null {
  if (c.status === 'depreciado') return env === 'dev' ? null : c.version;
  if (env === 'dev') return c.version;
  if (env === 'hml') return c.status === 'homologado' || c.status === 'publicado_prd' ? c.version : previousVersion(c);
  return c.status === 'publicado_prd' ? c.version : null;
}

function previousVersion(c: Component): string | null {
  const older = c.changelog.map((x) => x.version).filter((v) => semverSort(v, c.version) < 0).sort(semverSort);
  return older.length ? older[older.length - 1] : null;
}

function contractEnvVersion(c: DataContract, env: EnvId): string | null {
  const versions = c.versions.map((v) => v.version);
  const last = versions[versions.length - 1] ?? null;
  if (env === 'dev') return last;
  if (c.status === 'rascunho') return versions.length > 1 ? versions[versions.length - 2] : null;
  return last;
}

function VersionCell({ v }: { v: string | null }) {
  return v ? <Mono className="text-text">{v}</Mono> : <span className="text-text-muted">—</span>;
}

function EnvInventory() {
  const ws = useWs();
  const [tab, setTab] = useState<InvTab>('componentes');
  const components = ws.components;

  return (
    <Card>
      <CardHeader icon={Layers} title="Versões por ambiente" subtitle="Componentes, contratos e conectores também têm versão e credencial por ambiente" />
      <div className="px-4 pt-2">
        <Tabs<InvTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'componentes', label: `Componentes (${components.length})` },
            { id: 'contratos', label: `Contratos (${ws.contracts.length})` },
            { id: 'conectores', label: `Conectores (${ws.connectors.length})` },
          ]}
        />
      </div>
      <div className="max-h-[420px] overflow-auto p-4">
        {tab === 'componentes' && (
          <Table<Component>
            dense
            rows={components}
            rowKey={(c) => c.id}
            empty={<EmptyState icon={Boxes} title="Catálogo vazio" description="Componentes homologados aparecem aqui com a versão em cada ambiente." />}
            columns={[
              { key: 'n', header: 'Componente', render: (c) => <div className="min-w-0"><div className="truncate text-sm">{c.name}</div><div className="text-[11px] text-text-muted">{COMPONENT_TYPES[c.type].label}</div></div> },
              { key: 's', header: 'Status', render: (c) => <StatusChip status={c.status} /> },
              ...ENV_ORDER.map((e) => ({ key: e, header: <EnvBadge env={e} />, render: (c: Component) => <VersionCell v={componentEnvVersion(c, e)} /> })),
            ]}
          />
        )}
        {tab === 'contratos' && (
          <Table<DataContract>
            dense
            rows={ws.contracts}
            rowKey={(c) => c.id}
            columns={[
              { key: 'n', header: <Term term="contrato">Contrato</Term>, render: (c) => <div><div className="text-sm">{c.name}</div><div className="text-[11px] text-text-muted">{c.entity}</div></div> },
              { key: 's', header: 'Status', render: (c) => <StatusChip status={c.status} /> },
              ...ENV_ORDER.map((e) => ({ key: e, header: <EnvBadge env={e} />, render: (c: DataContract) => <VersionCell v={contractEnvVersion(c, e)} /> })),
            ]}
          />
        )}
        {tab === 'conectores' && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <KeyRound className="h-3.5 w-3.5" /> O mesmo conector aponta para o sandbox em Dev e para produção em Prd. O segredo fica no cofre; aqui só aparece a referência.
            </p>
            {ws.connectors.length === 0 && <EmptyState title="Nenhum conector" description="Conectores cadastrados mostram aqui a credencial de cada ambiente." />}
            {ws.connectors.map((c: Connector) => (
              <div key={c.id} className="rounded-field border border-border bg-surface-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  <StatusChip status={c.status} />
                </div>
                <div className="mt-2 grid gap-1.5">
                  {ENV_ORDER.map((e) => {
                    const cred = c.envs[e];
                    return (
                      <div key={e} className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-2 text-xs">
                        <EnvBadge env={e} />
                        {cred ? (
                          <>
                            <Mono className="truncate text-text" >{cred.endpoint}</Mono>
                            <span className="flex min-w-0 items-center gap-1 text-text-muted" title="Referência ao segredo no cofre (nunca o valor)">
                              <Lock className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                              <Mono className="truncate">{cred.secretRef}</Mono>
                            </span>
                          </>
                        ) : (
                          <span className="col-span-2 text-text-muted">sem credencial neste ambiente</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
