'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, GitBranch, Rocket, Undo2, Workflow, AlertTriangle, Star } from 'lucide-react';
import { ENV_ORDER, ENVS, PROFILES, can, type EnvId, type Journey, type PermissionAction } from '@cortex/schemas';
import { formatNumber, relativeTime } from '@cortex/engine';
import { demoNow, useCortex, useProfile, useWs } from '@/lib/store';
import { Button, Card, CardHeader, Chip, EmptyState, EnvBadge, Modal, Mono, NoPermission, cx } from '@/components/ui';
import { diffCounts, rollbackTarget } from './util';

export function DiffChips({ j, from, to }: { j: Journey; from: string | null; to: string | null }) {
  if (!from || !to) return <span className="text-[11px] text-text-muted">—</span>;
  if (from === to) return <span className="text-[11px] text-text-muted">mesma versão</span>;
  const d = diffCounts(j, from, to);
  if (!d) return <span className="text-[11px] text-text-muted">sem grafo</span>;
  if (!d.added && !d.removed && !d.changed) return <span className="text-[11px] text-text-muted">sem mudança no fluxo</span>;
  return (
    <span className="flex flex-wrap items-center justify-center gap-1 font-mono text-[11px]">
      {d.added > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-primary">+{d.added} {d.added === 1 ? 'nó' : 'nós'}</span>}
      {d.removed > 0 && <span className="rounded-full bg-danger/10 px-1.5 text-danger">−{d.removed}</span>}
      {d.changed > 0 && <span className="rounded-full bg-accent/10 px-1.5 text-accent">~{d.changed}</span>}
    </span>
  );
}

function EnvCell({ j, env }: { j: Journey; env: EnvId }) {
  const ws = useWs();
  const v = j.envVersions[env];
  const lastPrd = env === 'prd' ? ws.releases.find((r) => r.journeyId === j.id && r.to === 'prd' && r.status !== 'bloqueada' && r.version === v) : undefined;
  const created = v ? j.versions.find((x) => x.version === v)?.createdAt : undefined;
  return (
    <div
      className={cx('rounded-field border px-3 py-2 transition-colors duration-200', v ? 'bg-surface-2' : 'border-dashed bg-transparent')}
      style={v ? { borderColor: `${ENVS[env].color}55` } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <EnvBadge env={env} />
        {v ? <Mono className="text-sm font-semibold text-text">{v}</Mono> : <span className="text-sm text-text-muted">—</span>}
      </div>
      <div className="mt-1 truncate text-[11px] text-text-muted">
        {v ? (
          <>
            {created ? relativeTime(created, demoNow()) : ''}
            {lastPrd?.trafficPct !== undefined && lastPrd.trafficPct < 100 ? ` · ${lastPrd.trafficPct}% do tráfego` : ''}
          </>
        ) : (
          'ausente neste ambiente'
        )}
      </div>
    </div>
  );
}

function nextStep(j: Journey, pendingApprovers: string[]): { text: string; tone: 'muted' | 'yellow' | 'green' | 'purple' } {
  const { dev, hml, prd } = j.envVersions;
  if (pendingApprovers.length) return { text: `Hml → Prd aguardando ${pendingApprovers.join(' e ')}`, tone: 'yellow' };
  if (dev && !hml) return { text: 'Próximo passo: promover para Hml (gates do Champion AI)', tone: 'purple' };
  if (hml && hml !== prd) return { text: 'Pronta para pedir Prd (CoE AI e dono de negócio)', tone: 'purple' };
  if (dev && hml && prd && dev === hml && hml === prd) return { text: 'Mesma versão nos três ambientes', tone: 'green' };
  if (dev && dev !== hml) return { text: 'Dev à frente de Hml: nova versão em teste', tone: 'muted' };
  return { text: 'Estável', tone: 'green' };
}

export function JourneyPipeline() {
  const ws = useWs();
  const [rollback, setRollback] = useState<Journey | null>(null);

  const journeys = useMemo(
    () => [...ws.journeys].sort((a, b) => Number(!!b.anchor) - Number(!!a.anchor)),
    [ws.journeys],
  );

  return (
    <Card data-tour="ambientes-pipeline">
      <CardHeader
        icon={Workflow}
        title="Esteira Dev → Hml → Prd"
        subtitle="Versão de cada jornada por ambiente e o que muda entre elas (nós adicionados, removidos e alterados)"
      />
      {journeys.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="Nenhuma jornada ainda"
            description="Jornadas criadas no Studio aparecem aqui com a versão em cada ambiente."
            action={<Link href="/jornadas"><Button variant="primary" size="sm">Ir para Jornadas</Button></Link>}
          />
        </div>
      ) : (
        <div className="divide-y divide-border">
          <div className="hidden grid-cols-[minmax(220px,1.3fr)_1fr_80px_1fr_80px_1fr_auto] items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-text-muted lg:grid">
            <span>Jornada</span>
            <span>Dev</span>
            <span className="text-center">muda</span>
            <span>Hml</span>
            <span className="text-center">muda</span>
            <span>Prd</span>
            <span className="text-right">Ações</span>
          </div>
          {journeys.map((j) => {
            const pending = ws.approvals.filter((a) => a.kind === 'promocao' && a.status === 'pendente' && a.objectId.startsWith(j.id));
            const approvers = pending.map((a) => PROFILES[a.approverProfile].label.toLowerCase());
            const step = nextStep(j, approvers);
            const canRollback = ENV_ORDER.some((e) => rollbackTarget(ws, j, e));
            return (
              <div key={j.id} className="grid grid-cols-1 items-center gap-2 px-4 py-3 lg:grid-cols-[minmax(220px,1.3fr)_1fr_80px_1fr_80px_1fr_auto]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {j.anchor && <Star className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} aria-label="Jornada-âncora" />}
                    <span className="truncate text-sm font-semibold" title={j.name}>{j.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Chip tone={j.type === 'agentica' ? 'purple' : 'muted'}>{j.type === 'agentica' ? 'Agêntica' : 'Automação'}</Chip>
                    <Chip tone={step.tone} icon={step.tone === 'yellow' ? Clock : step.tone === 'green' ? undefined : GitBranch}>
                      <span className="max-w-[240px] truncate">{step.text}</span>
                    </Chip>
                  </div>
                </div>
                <EnvCell j={j} env="dev" />
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
                  <DiffChips j={j} from={j.envVersions.hml} to={j.envVersions.dev} />
                </div>
                <EnvCell j={j} env="hml" />
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
                  <DiffChips j={j} from={j.envVersions.prd} to={j.envVersions.hml} />
                </div>
                <EnvCell j={j} env="prd" />
                <div className="flex justify-end gap-1.5">
                  <Link href={`/jornadas/studio?id=${encodeURIComponent(j.id)}`}>
                    <Button size="sm" variant="primary" icon={Rocket}>Promover</Button>
                  </Link>
                  <Button size="sm" variant="tertiary" icon={Undo2} disabled={!canRollback} title={canRollback ? 'Voltar para a versão anterior' : 'Sem versão anterior para voltar'} onClick={() => setRollback(j)}>
                    Rollback
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {rollback && <RollbackModal journey={rollback} onClose={() => setRollback(null)} />}
    </Card>
  );
}

const ROLLBACK_PERMISSION: Record<EnvId, PermissionAction> = { dev: 'editar_jornada', hml: 'promover_hml', prd: 'aprovar_prd' };

function RollbackModal({ journey, onClose }: { journey: Journey; onClose: () => void }) {
  const ws = useWs();
  const profile = useProfile();
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const j = ws.journeys.find((x) => x.id === journey.id) ?? journey;
  const envs = ENV_ORDER.filter((e) => rollbackTarget(ws, j, e));
  const [env, setEnv] = useState<EnvId>(envs.includes('prd') ? 'prd' : envs[envs.length - 1] ?? 'dev');
  const cur = j.envVersions[env];
  const target = rollbackTarget(ws, j, env);
  const allowed = can(profile, ROLLBACK_PERMISSION[env], 'dev');
  const channels = ws.channels.filter((c) => c.journeyByEnv[env] === j.id);
  const execs = ws.executions.filter((e) => e.journeyId === j.id && e.env === env);
  const d = target && cur ? diffCounts(j, cur, target) : null;

  const confirm = () => {
    if (!target || !cur) return;
    const user = ws.users.find((u) => u.profile === profile)?.name ?? 'Usuário da demo';
    const before = mutate(
      (draft) => {
        const dj = draft.journeys.find((x) => x.id === j.id);
        if (!dj) return;
        dj.envVersions[env] = target;
        draft.releases.unshift({
          id: `rel-live-${Date.now()}`,
          journeyId: j.id,
          from: env === 'prd' ? 'hml' : env === 'hml' ? 'dev' : 'dev',
          to: env,
          version: target,
          at: demoNow(),
          by: user,
          status: 'rollback',
          ...(env === 'prd' ? { trafficPct: 100 } : {}),
        });
      },
      { action: `Fez rollback em ${ENVS[env].label}`, object: `${j.name} ${cur} → ${target}` },
    );
    toast({
      kind: 'sucesso',
      title: `Rollback em ${ENVS[env].label} concluído`,
      description: `${j.name} voltou de ${cur} para ${target}. Registrado na auditoria.`,
      undo: before ? () => replaceWorkspace(before) : undefined,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Rollback para a versão anterior"
      subtitle={j.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={Undo2} disabled={!target || !allowed} onClick={confirm}>
            Fazer rollback em {ENVS[env].label}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {envs.map((e) => (
            <button
              key={e}
              onClick={() => setEnv(e)}
              className={cx('rounded-full border px-3 py-1 text-xs', env === e ? 'border-primary bg-primary/10 text-text' : 'border-border text-text-muted hover:text-text')}
            >
              {ENVS[e].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-field border border-border bg-surface-2 p-3">
          <EnvBadge env={env} />
          <Mono className="text-sm">{cur}</Mono>
          <ArrowRight className="h-4 w-4 text-text-muted" />
          <Mono className="text-sm text-primary">{target ?? '—'}</Mono>
          {d && (
            <span className="ml-auto text-xs text-text-muted">
              {d.removed > 0 ? `${d.removed} nó(s) deixam de existir` : ''}
              {d.removed > 0 && (d.added > 0 || d.changed > 0) ? ' · ' : ''}
              {d.added > 0 ? `${d.added} nó(s) voltam` : ''}
              {d.changed > 0 ? ` · ${d.changed} alterado(s)` : ''}
            </span>
          )}
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Impacto
          </div>
          <ul className="space-y-1 text-sm text-text-muted">
            <li>
              {channels.length
                ? `Canais que passam a atender com ${target}: ${channels.map((c) => c.name).join(', ')}.`
                : `Nenhum canal vinculado a esta jornada em ${ENVS[env].label}.`}
            </li>
            <li>{formatNumber(execs.length)} execuções recentes em {ENVS[env].label} rodaram a versão atual; o histórico é mantido.</li>
            <li>A versão {cur} continua no histórico e pode ser promovida de novo.</li>
            <li>O rollback é registrado na auditoria e na linha do tempo de releases.</li>
          </ul>
        </div>
        {!allowed && <NoPermission action={ROLLBACK_PERMISSION[env]} />}
      </div>
    </Modal>
  );
}
